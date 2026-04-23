# Kunlungame

Kunlungame 是一款面向 Windows 的本地桌面叙事游戏。题材围绕昆仑神话与中华文明长脉络，采用 8 节点主线，驱动层使用本地 GGUF 模型（Qwen2.5-7B 或 3B 兜底），在离线状态下完成一轮轮沉浸式、可追问的对话。

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
8. `pnpm knowledge:compile`   — 把 `md/knowledge/**/*.md` 编译为 `src/content/generated/knowledgeEntries.json`
9. `pnpm models:download`     — 获取 Qwen2.5-7B / 3B GGUF 到 `runtime-cache/models/**`
10. `pnpm dialogue:smoke`     — 本地跑首节点端到端烟雾，验证 GGUF 路径 + 编排 + 流式

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

`pnpm dev` 会打开桌面壳，默认以 mock 流跑通主线前两回合：chunk → options → 态度钳制 → 摘要更新 → 节点推进。关闭 mock 流开关后，每轮对话会经 `desktop:run-mainline-turn` IPC 打到主进程里的 `localDialogueDependencies`，由本地 GGUF 完成文本与选项生成。

## 验证矩阵

1. `pnpm typecheck` — `tsc --noEmit` + `vue-tsc --noEmit`
2. `pnpm test --run` — Vitest 30 test files / 150 tests
3. `pnpm test:e2e` — Playwright 渲染层黑盒
4. `pnpm coverage` — 覆盖率报告（核心模块 ≥ 90%，总线 ≥ 80%）
5. `docs/audits/2026-release-audit-template.md` — 正式发布前填写审计记录

## 仍需交付的素材

1. 真正的 GGUF 权重（首选 `qwen2.5-7b-instruct-q4_k_m.gguf`，兜底 3B）。
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
