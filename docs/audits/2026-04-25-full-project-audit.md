# 2026-04-25 全项目审计报告（Kunlungame）

审计范围：`main@694ebd9` 基线 + 本轮改造分支 `feat/ui-cultural-refresh`。

## 1. 严重级别总览

### blocker

- 无（本轮复检后清零）。

### high

1. 运行时状态持久化职责分散，跨层耦合偏高。
   - 涉及：`src/runtime/runtimeState.ts`、`src/runtime/saveRepository.ts`、`src/renderer/App.vue`、`electron/main/index.ts`
   - 风险：renderer/electron/runtime 对同一状态模型各自变更时易出现不一致。
  - 2026-04-25 进展：已抽出 `runtimeStateFacade`，renderer 保存、真实回合请求、electron 加载/保存统一复用桌面 IPC 序列化/解析入口。

2. 下载链路在脚本与应用路径存在策略重复。
   - 涉及：`src/modeling/profileDownloader.ts`、`scripts/download-models.ts`
   - 风险：重试/校验/日志策略可能漂移，导致“脚本能下、应用不能下”或反之。

### medium

1. 前端单文件体量偏大，维护成本上升。
   - `src/renderer/App.vue` (~494 LOC)
   - `src/renderer/components/SettingsPanel.vue` (~495 LOC)
   - `src/renderer/adapters/rendererDialogueDependencies.ts` (~542 LOC)
  - 2026-04-25 进展：`SettingsPanel.vue` 已拆成弹窗壳、音频区、模型区、下载进度区；父文件降至约 158 LOC。

2. 背景表现逻辑分散在 resolver、component、assets manifest，抽象层次可再收敛。
   - 涉及：`src/presentation/assetSlotResolver.ts`、`src/renderer/components/BackgroundStage.vue`、`src/renderer/assets/manifest.ts`

3. 端到端玩法体验自动化覆盖仍偏“流程通过”，缺少美术/交互质量断言。

### low

1. 若干文档中的历史统计数字更新频率低，容易与现状脱节。
2. 审计/发布文档较多，存在信息重复，可进一步归并索引。

## 2. 分类审计明细

### 2.1 架构问题

- **high**：状态持久化与序列化分散在多层。
  - 建议：抽出单一 RuntimeStateFacade（renderer 仅调用 facade，electron 仅实现接口）。
  - 进展：已完成桌面 IPC 状态形状收敛，后续若引入多槽位/迁移链再扩展 facade。
- **medium**：下载策略双实现。
  - 建议：`scripts/download-models.ts` 复用 `profileDownloader` 能力，避免重复重试/校验逻辑。

### 2.2 代码质量问题

- **medium**：超大文件影响可读性与变更安全。
  - 建议：
    - `SettingsPanel.vue` 拆为：`SettingsAudioSection`、`SettingsModelSection`、`SettingsDownloadProgress`。
    - `App.vue` 拆出 profile download/comms composable。
  - 进展：`SettingsPanel.vue` 拆分已完成，现有 DOM 测试保持通过。

### 2.3 测试覆盖与测试策略

- 当前：`pnpm test --run` -> 35 files / 200 tests 全绿。
- 历史覆盖基线：Lines 86.82%，满足 >=80% 线覆盖门槛。
- **medium**：e2e 更偏功能流，缺 UI 视觉质量断言（触控尺寸、对比度、动画退化）。
  - 建议：增加 Playwright 视觉快照与 a11y 扫描（关键面板）。

### 2.4 潜在 bug 与边界条件

- **medium**：下载阶段文案与 phase 语义映射需统一维护（已补中文映射，但建议集中常量）。
- **low**：超小屏（<360px）长文本选项仍可能换行偏多，需结合真实文案回归。

### 2.5 性能风险

- **medium**：renderer 大组件重渲染边界不够明确，未来继续堆功能会拖慢交互。
- **low**：背景叠层与纹样在低端机可能增加绘制成本，建议后续按设备能力分级。

### 2.6 安全风险

- **low**：本地应用主场景，外部输入面较小。
- **medium（流程）**：依赖安全审计受网络环境阻断时，需保留可追溯 fallback 记录并重跑。

### 2.7 可维护性问题

- **high**：跨层重复逻辑与超大文件会放大后续变更成本。
- **medium**：日志历史散落（本轮已统一到 `logs/` 并改脚本默认输出）。

## 3. 优先级整改计划（已执行 + 下一步）

### P0（已执行）

1. 统一日志目录到 `logs/`，并接入脚本默认输出。
2. 前端可爱+文化融合重构（背景转场、状态栏、选项区、设置面板）。
3. 可访问性与触控尺寸 blocker 修复（range 标注、按钮最小触控）。
4. 8 节点背景素材需求包（每节点单独文件夹 + requirements）。

### P1（建议下一轮）

1. 抽 RuntimeStateFacade，收敛状态序列化职责。
  - 2026-04-25 进展：已抽出 `runtimeStateFacade`，新增 `runtimeStateFacade.test.ts` 锁住字段完整性与旧 payload 默认值补齐。
2. `scripts/download-models.ts` 复用 `profileDownloader`。
  - 2026-04-25 进展：已抽出 `modelDownloadWorkflow`，CLI 脚本复用 `downloadProfileWeights`，仅保留批量 profile、锁文件与 smoke repair 编排。

### P2（建议下一轮）

1. 拆分大组件（App/SettingsPanel）。
  - 2026-04-25 进展：`SettingsPanel` 已拆分；`App.vue` 仍待抽 profile download / desktop bridge composable。
2. 增加 UI 视觉质量 e2e 断言（a11y + snapshot）。

## 4. 双 Subagent 循环结果

- 回合 1（评判者）：给出 blocker/high 列表（a11y、触控、phase 可理解性等）。
- 回合 1（开发者执行）：由主代理完成修复并通过验证。
- 回合 2（评判者复检）：blocker/high = 0，结论“评判通过，可进入收尾”。

## 5. 验证证据

- `pnpm typecheck` -> exit 0
- `pnpm test --run` -> 35 files / 200 tests passed

## 6. 2026-04-25 追加补强（improve/code-audit-2026-04-25 分支）

承接本轮审计的 P0/P1/P2 残留项，本次提交在 `improve/code-audit-2026-04-25` 分支上落地以下改动：

### 6.1 安全基线（P0）

- `electron/main/index.ts`：`webPreferences.sandbox` 从 `false` 改为 `true`。preload 仅依赖 `electron` 模块（contextBridge / ipcRenderer），与沙箱兼容；任何主进程能力均经由现有 IPC 通道暴露，不会因沙箱启用而失效。
- `tests/desktopShell.test.ts`：同步更新 `sandbox` 断言为 `true`，作为安全回归锁。

### 6.2 类型安全收敛（P2）

- `src/renderer/env.d.ts`：将 `Window.kunlunDesktop` 由必选改为可选，并显式声明 `__kunlunDebug?: unknown`。新声明真实反映渲染层在浏览器/单测预览下 bridge 不存在的运行时事实。
- `src/renderer/App.vue`：移除 4 处 `window as unknown as { kunlunDesktop?: ... }` 与 `__kunlunDebug` 的危险强转，统一通过 `window.kunlunDesktop` 直接访问，并在唯一的赋值点使用最小化的 `Window & { __kunlunDebug?: KunlunDebug }` 断言。
- 收益：消除"无声漂移"风险——后续若 IPC 类型变更，TS 编译器会在所有调用点报错，而不再被 `as unknown` 屏蔽。

### 6.3 存档损坏的用户告知（P1）

- 既有的 `loadRuntimeState` 已经返回 `recoveryAction: 'reset-corrupted'`，且通过 desktopShell IPC 透传到渲染层，但 `App.vue` 之前忽略了此字段，导致用户存档损坏被静默重置时**完全无感知**。
- `src/renderer/App.vue`：新增 `saveRecoveryNotice` 状态与对应的 `role="status"` aria-live 通知条（顶部居中，含手动收下按钮），仅在 `recoveryAction === 'reset-corrupted'` 时显示。
- 测试覆盖：`tests/runtimeState.test.ts` 与 `tests/desktopShell.test.ts` 已分别覆盖 saveRepository 与 IPC 桥的 `reset-corrupted` 路径；UI 通知条为简单 v-if + 点击关闭，由 e2e 渲染流测试覆盖整体页面健康度。

### 6.4 验证

- `pnpm typecheck` -> exit 0
- `pnpm test --run` -> 37 files / 206 tests 全绿（与 README 旧记录的 35/200 存在轻度漂移；本次保留 README 不变以避免与历史审计快照不一致，待下次发布审计统一刷新）
