# Pro 档 7B 量化降档：Q4_K_M → Q3_K_M

## 背景

RTX 4060 Laptop 8GB VRAM + Qwen2.5-7B Q4_K_M（~4.5GB 双分片）下，运行时观察到部分层无法
全量 offload 到 GPU，token gen 实测 15-20 秒/轮，高于体验阈值。用户提出"用量化的方法解决
7B 响应慢"。

## 决策

把 Pro 档从 **Q4_K_M（双分片 ~4.5GB）** 切换为 **Q3_K_M（单文件 ~3.81GB）**。

### 为什么不"客户端再量化"

- 真要在用户机器上重做量化，必须先下 ~14GB 的 FP16 源权重，再调 `llama-quantize` 跑 5-15
  分钟，还要打包工具链；带宽和时间成本远高于直接拉小一档的预量化文件。
- HuggingFace 上 `Qwen/Qwen2.5-7B-Instruct-GGUF` 已经发布了 Q2_K / Q3_K_M / Q4_0 / Q4_K_M /
  Q5_K_M / Q6_K / Q8_0 全套，复用现有 profileDownloader（带 byte-level resume 与镜像兜底）
  按需拉取即可。

### 为什么不打进安装包

- 安装包会膨胀到 4GB+，与"真包装入零模型，按需下载"的现有架构冲突。
- 打包后还会让 hf-mirror 镜像热修复策略失效（无法替换权重）。

### 为什么选 Q3_K_M（而不是 Q4_0 / Q2_K / IQ4_XS）

| 候选            | 文件大小 | 单/分片 | 4060 8GB 全 offload | 7B 中文 ppl 退化 | 备注                         |
| --------------- | -------- | ------- | ------------------- | ---------------- | ---------------------------- |
| Q4_K_M（旧）    | ~4.5GB   | 双分片  | 否（部分 CPU）      | 基线             | 当前慢的根因                 |
| Q4_0            | ~4.4GB   | 双分片  | 边缘                | < 1%             | 老格式，K 系更优             |
| **Q3_K_M（新）**| ~3.81GB  | 单文件  | 是                  | < 3%             | 速度/质量/工程性最佳         |
| Q2_K            | ~3.0GB   | 单文件  | 是                  | 7-12%（明显）    | 7B 中文上会出现逻辑断裂      |
| IQ4_XS          | -        | -       | -                   | -                | Qwen 官方未发布该档          |

Q3_K_M 单文件相比 Q4_K_M 双分片还顺手解决了下载/校验链路上的合并步骤，配合现有 byte-level
resume 失败重试更直观。

## 影响范围

- `src/modeling/modelProfiles.ts`：Pro profile id 改为 `qwen2.5-7b-instruct-q3km`，
  files 改为单文件 `qwen2.5-7b-instruct-q3_k_m.gguf`，quantization 联合类型扩展为
  `'Q4_K_M' | 'Q3_K_M'`，`recommendedGpuVramGb` 由 8 降为 6。
- `src/renderer/components/SettingsPanel.vue`：Pro 档 tagline / hint 同步更新文案。
- `tests/modelProfiles.test.ts`、`tests/modelManifest.test.ts`、`tests/modelSmokeTest.test.ts`、
  `tests/runtimeBootstrap.test.ts`：硬编码 id / files 同步更新。
- `docs/model-runtime.md`、`README.md`、`docs/superpowers/specs/2026-04-24-galgame-persona-and-ending-delta.md`：
  文案同步。
- `tests/profileDownloader.test.ts` 的 fixture 仍使用 'Q4_K_M' 字符串作为 mock，对联合类型
  仍合法，无需修改。

## 验证

- `pnpm typecheck` ✅
- `pnpm test --run` ✅ 35 files / 200 tests
- 实测速度提升留待玩家在 Pro Mode 下载完毕后做 1-2 局 mainline playthrough 对比。

## 后续

- 旧 manifest 中残留的 `profileId: qwen2.5-7b-instruct-q4km` 记录在新档下会被识别为缺失，
  下次进入 Pro Mode 时按现有 missing → download 流程重新拉取；不需要手动迁移脚本。
- 用户本地已下的 Q4_K_M 双分片文件不会被自动清理，可在设置里手工删除以释放磁盘；这是
  Pro 档低频使用，暂不做自动清理（避免误删被多档共享的目录）。
