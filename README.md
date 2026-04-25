# Kunlungame

Kunlungame 是一款面向 Windows 的本地桌面叙事游戏。题材围绕昆仑神话与中华文明长脉络，采用 8 节点主线，驱动层使用本地 GGUF 模型（默认 Qwen2.5-3B Quality Mode，可选 1.5B Lite 纯 CPU 兜底 / 7B Pro 独显档），在离线状态下完成一轮轮沉浸式、可追问的对话。

## 当前可运行能力

1. Electron 35 + Vue 3 + TypeScript 5 + electron-vite + Vite 的最小工程骨架。
2. 8 节点主线：`kunlun-threshold` → `creation-myths` → `civilization-roots` → `order-and-thought` → `empire-and-openness` → `fusion-and-refinement` → `rupture-and-guardianship` → `contemporary-return`。
3. 预编译知识库：从受约束 Markdown 编译出结构化知识条目，按节点 / 关键词 / 主题检索。
4. 运行时状态：默认存档 / 态度钳制 / 回合推进 / 最近摘要 / 已读节点 / 损坏存档安全回退。
5. Prompt 层：多层上下文构造器 + orchestrator，把节点、检索、态度倾向、最近摘要组合成 chat 消息。
6. 本地推理：`node-llama-cpp` 适配器完成流式文本 + 两个 `align/challenge` 选项的生成。
7. 桌面 IPC 桥：`desktop:ping` / `desktop:get-startup-snapshot` / `desktop:run-dialogue-smoke` / `desktop:run-mainline-turn` / `desktop:load-runtime-state` / `desktop:save-runtime-state` 全部挂到 `window.kunlunDesktop`。
8. 渲染层：键盘可达、焦点陷阱、reduced-motion、资源槽位解析、BGM 控制、逐字呈现；支持 mock 流与真实本地模型两种依赖工厂热切换。
9. 资产槽位：8 个主线节点均有 ≤4KB 的占位 SVG 背景与人物轮廓，为正式素材预留接口。

## 开发命令

1. `pnpm install`
2. `pnpm dev`                 — 启动桌面壳（先 `pnpm build` 生成 main/preload 产物）
3. `pnpm build`               — 打包主进程、预加载、渲染层与 TS 产物
4. `pnpm typecheck`           — `tsc --noEmit` + `vue-tsc --noEmit`
5. `pnpm test`                — Vitest 单元 / 集成测试
6. `pnpm test:e2e`            — Playwright 渲染层黑盒烟雾
7. `pnpm coverage`            — 覆盖率报告
8. `pnpm knowledge:compile`   — 把 `docs/knowledge-base/cultural-knowledge.md` 与 canonical 主线编译为 `src/content/generated/knowledgeEntries.json` / `storyOutline.json`
9. `pnpm models:download`     — 获取 Qwen2.5-3B (默认质量档) + 1.5B (可选纯 CPU Lite 兜底) GGUF 到 `runtime-cache/models/**`；7B Pro 档需手动下载
10. `pnpm dialogue:smoke`     — 本地跑首节点端到端烟雾，验证 GGUF 路径 + 编排 + 流式
11. `pnpm playthrough -- --pattern=alt --maxNodes=8` — 8 节点全链路重放，记录 per-node 滚动、attitudeScore、完整文本

## 统一日志目录

- 运行时和脚本生成日志统一写入项目根目录 `logs/`。
- 当前已接入：
  - `pnpm dialogue:smoke` -> `logs/dialogue-smoke/*.json`
  - `pnpm playthrough ...` -> `logs/playthroughs/*.md`
  - `pnpm models:download` -> `logs/model-downloads/*.log`
- 历史输出目录 `test-results/playthroughs` 不再作为脚本默认目标。

## 模型权重获取两条路径

- **命令行（开发态）**：`pnpm models:download` 批量拉默认 + Lite 档。
- **应用内（终端用户）**：在「设置」面板下点 “下载权重”，IPC 会流式回传 byte-level 百分比
  （`{已下载}MB / {总}MB · {N}%`），断点续传通过 HTTP Range 头自动恢复。

## 预览最小样品

前置条件：

1. Windows，Node ≥ 20，pnpm 10。
2. 如果要走真实模型路径，需事先 `pnpm models:download`（或手动把 GGUF 放到 `runtime-cache/models/qwen2.5-*/`），并在渲染层把 mock 流开关关闭。
3. 正式背景画面、立绘与 BGM 尚未接入时，仅能看到 ≤4KB 占位 SVG。

步骤：

```powershell
pnpm install
pnpm build
pnpm dev
```

`pnpm dev` 会打开桌面壳。在真实 Electron 桌面里，渲染层会**自动检测 `window.kunlunDesktop` 存在并默认切换到真实本地模型**：每轮对话经 `desktop:run-mainline-turn` IPC 打到主进程里的 `localDialogueDependencies`，由本地 GGUF 完成文本与选项生成；浏览器预览（`vite dev` 或 Playwright）下会自动回落到 mock 流，用于 UI 验证。需要手动切换时可在 DevTools 里执行 `__kunlunDebug.useMockStream(true|false)`。

## 验证矩阵

1. `pnpm typecheck` — `tsc --noEmit` + `vue-tsc --noEmit`
2. `pnpm test -- --run` — Vitest 35 test files / 200 tests
3. `pnpm test:e2e` — Playwright 渲染层黑盒（14 scenarios）
4. `pnpm coverage` — 覆盖率报告（整体 Lines ≥ 86%，核心模块 ≥ 90%）
5. `pnpm dialogue:smoke` — 本地 GGUF 端到端冷烟；设 `$env:KUNLUN_SMOKE_MODE='compatibility'` 切到 3B Quality profile 做 A/B；设 `$env:KUNLUN_FORCE_CPU='1'` 强制禁用 GPU 加速（默认会通过 Vulkan 自动识别独显）
6. `pnpm playthrough -- --pattern=alt --maxNodes=8` — 8 节点全链路端到端，最近一次：`docs/audits/2026-04-24-playthrough-8node.md`
7. `pnpm audit --prod --registry=https://registry.npmjs.org/` — 默认 npmmirror 不提供 audit endpoint，必须显式指向官方 registry
8. `docs/audits/2026-release-audit-template.md` — 正式发布前填写审计记录（最近一次：`docs/audits/2026-04-24-release-audit-rc2.md`）

## 仍需交付的素材

1. 真正的 GGUF 权重（默认 `qwen2.5-3b-instruct-q4_k_m.gguf` ~2GB，可选 1.5B Lite ~1.12GB 纯 CPU 兜底，可选 7B Pro `qwen2.5-7b-instruct-q3_k_m.gguf` ~3.81GB 需独显）。
2. 8 节点的正式背景（神话节点偏虚构意象，历史节点偏实景照片，过渡节点走组合策略）。
3. 人物立绘 / 剪影、转场 BGM 与 SFX。
4. 当素材齐备后，按 `docs/superpowers/specs/2026-04-23-part-07-visual-presentation-and-asset-slot-spec.md` 的槽位落位即可。

## 相关文档

1. `docs/superpowers/specs/2026-04-22-kunlun-ballad-desktop-design.md` — 总体设计。
2. `docs/superpowers/specs/2026-04-23-part-0*-*-spec.md` — 每个纵向 Part 的 spec。
3. `docs/asset-slot-rules.md` — 素材槽位规则。
4. `docs/content-markdown-format.md` — 内容 Markdown 写作格式。
5. `docs/knowledge-compilation.md` — 知识编译管线。
6. `docs/model-runtime.md` — 本地模型运行时约束。
7. `docs/runtime-state.md` — 运行时状态约定。
8. `docs/audits/2026-release-audit-template.md` — 发布审计模板。
