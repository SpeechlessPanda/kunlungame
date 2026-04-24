# Kunlungame Release Notes · 2026-04-24 (RC2)

> 目标受众：内部终端用户 / 首批外部体验者。
> 对应 commit：`4a2fb6e`（基线 `main`）。
> 审计记录：`docs/audits/2026-04-24-release-audit-rc2.md`。

## 本次新增

### 1. 应用内权重下载

过去需要先跑 `pnpm models:download` 命令才能切换到 Pro 档；本轮改成在
「设置」面板里直接点 **下载权重**：

- 三档（Lite 1.5B / Quality 3B / Pro 7B）独立可用性实时探测，状态为
  `ready / partial / missing` 三种。
- 下载过程在 IPC 通道上以阶段 + byte-level 百分比回传，UI 显示
  `{已下载}MB / {总}MB · {N}%`。
- 断点续传：若下载中断，重新点按会以 HTTP `Range` 头在已有文件末尾
  续接，不会从 0 重来；全部完成时自动落入 416 分支并校验哈希。
- 失败自动重试 3 次（1s / 2s / 3s 退避）。

### 2. 默认档位回到 3B Quality

经多轮 playthrough 对比，1.5B Lite 在主线长上下文下输出质量不稳定；
本版将 **默认档位恢复为 `qwen2.5-3b-instruct-q4km`（Quality）**，
1.5B 降级为“Lite 兜底”，7B Pro 保持 opt-in。

### 3. 端到端 QA 复测

在 Quality 档上跑 `pnpm playthrough -- --pattern=alt --maxNodes=8`：

- 29 轮完整跨 8 节点，`isCompleted=true`，`attitudeScore=1`，
  终节点 `contemporary-return`。
- 墙钟 6.35 min，平均每轮 ~13 s，最长一轮 19.9 s。
- 报告：`docs/audits/2026-04-24-playthrough-8node.md`。

## 兼容性与升级

- 存档：`RuntimeSettings` 新增 `preferredModelMode` 字段，zod 默认值
  `'default'`；旧存档自动补齐，无需手动迁移。
- 配置文件：`runtime-cache/models/manifest.json` 结构未变，只是
  新的下载器会**在每次写入时把对应 profileId 的记录替换掉**而不是追加，
  避免重复项。

## 已知限制

- 切换到 Pro 档第一次 `runMainlineTurn` 仍是冷启动（约 10–20 s）。
- `pnpm audit` 当前需要显式 `--registry=https://registry.npmjs.org/`，
  因为 npmmirror 未提供 audit endpoint。
- 主进程 / 模型加载内存峰值尚未在本轮做实机量测，沿用上一轮数据。

## 升级建议

1. `git pull`（`4a2fb6e`）。
2. `pnpm install`（lockfile 未动，通常是 no-op）。
3. `pnpm build`。
4. `pnpm dev` 启动桌面壳，在「设置」里挑选目标档位；若档位显示
   `missing`，点下载按钮即可，无需命令行。
5. 验证：`pnpm typecheck && pnpm test --run` 应全绿（35 files / 200 tests）。
