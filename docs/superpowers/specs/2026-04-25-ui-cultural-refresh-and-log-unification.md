# 2026-04-25 · UI Cultural Refresh + Log Unification

## 1. 目标

- 把运行时/脚本日志统一到单一目录 `logs/`。
- 将前端视觉升级为“可爱 + 文化气息”融合的 VN 舞台。
- 为 8 节点背景建立可执行的素材需求包，支持后续美术生成或检索。

## 2. 本次已实现

### 2.1 日志统一

- 新增脚本工具：`scripts/logPaths.ts`
- 输出路径改造：
  - `scripts/run-dialogue-smoke.ts` -> `logs/dialogue-smoke/*.json`
  - `scripts/run-mainline-playthrough.ts` -> `logs/playthroughs/*.md`
  - `scripts/download-models.ts` -> `logs/model-downloads/*.log`
- README 新增“统一日志目录”说明。
- `.gitignore` 新增 `logs/`（生成物不入仓）。

### 2.2 前端重构

- `BackgroundStage.vue`
  - 新增 keyed `Transition` 实现背景换场淡入淡出。
  - 增加花瓣薄雾与纹样层，统一舞台氛围。
- `StatusBar.vue`
  - 从冷暗渐变改为暖色宣纸风层叠背景。
  - 强化标题层级和微排版可读性。
- `ChoicePanel.vue`
  - 增加纹样高光层与更明确按压反馈。
- `SettingsPanel.vue`
  - 面板与遮罩统一暖色调。
  - 补齐 byte-level 进度行样式。
- `src/renderer/index.html`
  - 增加 Noto Sans/Serif SC 字体链接（有网络则生效，无网络自动回退）。

### 2.3 背景素材需求包

- 目录：`docs/asset-requests/backgrounds/`
- 每节点独立 `requirements.md`：
  - `kunlun-threshold`
  - `creation-myths`
  - `civilization-roots`
  - `order-and-thought`
  - `empire-and-openness`
  - `fusion-and-refinement`
  - `rupture-and-guardianship`
  - `contemporary-return`
- 共享转场规范：`_shared-transition-guidelines/requirements.md`

## 3. 仍受素材缺失影响的部分（明确 deferred）

- 真实背景图与角色立绘尚未落地，当前仍是“占位 + 需求包”组合。
- 章节级 cinematic 转场（基于真实图层深度）需在真实素材到位后做二次调优。

## 4. 质量门槛

- UI 改造不应改变主线状态机、对话调用、下载流程语义。
- 所有变更需通过 `pnpm typecheck` 与 `pnpm test --run`。
