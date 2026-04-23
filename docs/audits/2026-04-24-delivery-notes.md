# 2026-04-24 交付笔记 · 主线扩展 + 叙事密度 + UI 自适应

> 对应 pre-release 审计：`docs/audits/2026-04-24-release-audit.md`（commit 链：`f971f68 → 1a8e46d → 688c525 → 9d62893 → (本次) ...`）。

## 本轮交付一览

### 内容
- 主线从 3 节点扩到 **8 节点**（`kunlun-threshold → creation-myths → civilization-roots → order-and-thought → empire-and-openness → fusion-and-refinement → rupture-and-guardianship → contemporary-return`）。
- 每个节点：`mustIncludeFacts` 5~6 条 + 新增 `transitionHint` 转场提示 + `minTurns`（3/4/3/4/4/4/4/3）。
- 神话/史实节点分别走 "虚构意象 / 实景照片 / 过渡组合" 三种画面模式，符合 §9 hybrid background 策略。

### 运行时
- `runtimeState` 新增 `turnsInCurrentNode` 字段，`applyPlayerChoice` 按 `minTurns` 门槛推进，终节点也需满足才能进入升华轮。
- 存档 `saveVersion` 保持为 1；`zod` schema 通过 `.default(0)` 向前兼容旧存档。

### Prompt & 行为限定
- `storyPromptBuilder` 系统提示新增「行为限定（严禁越界）」6 条（不跳时空/不编造/不出戏/不列清单/不自称 AI/不剧透未来节点）。
- 用户提示按 `turnsInCurrentNode === 0` 决定注入 `transitionHint` 还是「节点进度：本节点内第 N 轮」提示。
- **strictCoverage 模式**：检测到当前运行在 3B fallback 时（`selectedProfile.id === getFallbackModelProfile().id`），自动注入「必须按顺序逐条覆盖 mustIncludeFacts」的强覆盖段落。

### AI 接入
- 默认 `maxTokens` 120 → **512**（7B 不再被截断到 168 字）。
- **桌面壳下自动接入真模型**：`App.vue` `onMounted` 探测 `window.kunlunDesktop`，真机运行直接走 `desktop:run-mainline-turn` IPC；浏览器预览/Playwright 继续走 mock。手动覆盖仍可用 `__kunlunDebug.useMockStream(true|false)`。
- 真实 `node-llama-cpp` 装配代码拆到独立 `src/modeling/realLlamaSession.ts`，流式/重试/终止等纯逻辑保留在 `localDialogueDependencies.ts`，单元测试覆盖到 9 个用例。

### Smoke 结构化日志
- `DialogueSmokeTestResult` 新增 `elapsedMs / firstChunkMs / strictCoverage` 三个字段。
- `scripts/run-dialogue-smoke.ts` 支持 `KUNLUN_SMOKE_MODE=compatibility` 切 3B profile，便于 A/B 对照。
- 实测数据见 `docs/dialogue-smoke-3b-vs-7b.md`：strictCoverage=true 下 3B `chunkCount` 64 → 236、正文 120 字 → 360 字、覆盖到 4/5 条 mustIncludeFacts，代价是 `elapsedMs≈514s / firstChunkMs≈213s`。

### UI
- `DialogPanel` 对话框高度 `clamp(180px, 22vh, 240px) → min(55vh, 520px)`，随 AI 输出长短自动伸缩，内部滚动保留粉色细滚动条。
- `BackgroundStage` 淡色柔光滤镜 + 模式胶囊字段调色。
- `StatusBar` 新增 `isFallbackModel` 开关，3B 运行时渲染「轻量模型 · 叙事密度已压缩」胶囊，告知玩家长度预期。
- 选项文案由 `buildGalgameOptionLabels({ turnIndex, isEnding })` 从 14 条自然化池里选，替换之前的机械拼接。

### 测试 & 质量
- 单元 / 集成：32 files · **171 tests** 全部通过。
- 黑盒：Playwright 14 scenarios 全通过（节点推进断言已改为循环点击 `minTurns` 次）。
- 覆盖率：Lines **89.39%**（总线 ≥ 80% 门槛），`modeling/` 目录 91.22%，核心模块（`runtimeState`、`knowledgeCompilation`、`knowledgeRetrieval`、`storyPromptBuilder`、`layeredContextBuilder`、`dialogueOrchestrator`）全部 ≥ 90%。

## 已记录但本轮未关闭的 deferred

1. 主进程空闲内存 + 模型加载内存峰值的实机量测（正式发布前补）。
2. `localDialogueDependencies.ts` 尾部 2 个少用错误分支覆盖率（当前 ~83% branch）。
3. `contemporary-return` 终节点史实锚点再细化。

## 验证矩阵（本轮实际跑过）

| 步骤   | 命令                                                       | 结果                 |
|--------|------------------------------------------------------------|----------------------|
| 安装   | `pnpm install --frozen-lockfile`                           | pass                 |
| 安全   | `pnpm audit --prod --registry=https://registry.npmjs.org/` | 0 漏洞               |
| 类型   | `pnpm typecheck`                                           | pass                 |
| 单测   | `pnpm test -- --run`                                       | 32 files / 171 tests |
| e2e    | `pnpm playwright test`                                     | 14 scenarios         |
| 覆盖率 | `pnpm coverage`                                            | Lines 89.39%         |
| 构建   | `pnpm build`                                               | out ~0.47 MB         |
| smoke  | `pnpm dialogue:smoke` (默认 + compatibility)               | 两种 profile 均完成  |
