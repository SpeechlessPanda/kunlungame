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

## 7. 2026-04-25 IPC 边界运行时校验（improve/ipc-runtime-validation 分支）

### 7.1 背景

P0 启用 sandbox 后，preload 不能再 `require('zod')`（externalizeDepsPlugin 让 zod 走运行时 require）。但 IPC 类型断言无运行时验证仍是 P1 风险：主进程未来如果改字段、漏字段、误返回 null，渲染层只会在使用点上崩溃，难以归因。

### 7.2 设计选择

- **Schema 单一真相源**：`src/shared/types/desktop.schemas.ts` 用 Zod 描述全部 IPC 返回值结构。
- **校验放在渲染层**：新建 `src/renderer/lib/desktopBridgeClient.ts` 暴露 `wrapDesktopBridgeWithValidation(raw)`，在每个 invoke 返回点上做 `schema.parse`。preload 保持轻量，不引入新依赖、不影响沙箱兼容性。
- **失败语义**：抛出 `IpcContractError`（携带 `channel` + `cause`），调用方按既有 catch 逻辑处理；UI 失败态文案保持。
- **进度事件容错**：`onProfileDownloadProgress` 内置 try/catch + 丢弃 + warn，畸形进度事件不会中断下载链路。

### 7.3 落点

- `src/renderer/App.vue#getBridge`：现在返回校验包裹后的 bridge；`runMainlineTurn` 经由 `getBridge()` 拿到再交给 `createBridgeDialogueDependenciesFactory`，整条对话路径都受保护。
- `tests/desktopBridgeClient.test.ts`（新增 12 个用例）：覆盖正常透传、缺字段、值越界、未知 reason、非法 recoveryAction、ping 类型不符、畸形 progress 容错、`IpcContractError` 元数据。

### 7.4 与 desktop.ts 类型契约的同步策略

短期：schema 与 `desktop.ts` 类型并存，依靠测试中"合法样本能 parse 通过"间接锁定一致性。
后续：若 contract 变更频繁，可改用 `z.infer` 派生 `desktop.ts` 的类型，进一步消除漂移。

### 7.5 验证

- `pnpm typecheck` -> exit 0
- `pnpm test --run` -> 38 files / 218 tests 全绿

## 8. 2026-04-25 下载链路真实缺陷修复（improve/unify-download-entry 分支）

审计原本将"统一下载入口"列为 P1，但复核发现 `modelDownloadWorkflow` 已经基本覆盖该项；真正遗留的是两处隐蔽 bug：

### 8.1 IPC 下载并发竞态（修复）

`electron/main/index.ts#runDesktopProfileDownload` 旧逻辑：

```ts
if (activeDesktopDownloads.has(profileId)) return { ... already-running }
const deps = await buildDependencies()  // ← await 间隙，守卫不再原子
activeDesktopDownloads.add(profileId)
```

两个并发 IPC 调用会双双通过 `has()` 检查，并在 await 期间同时进入下载链路，造成同一档位被并发写入相同目录。

修复：把 `add` 立刻提到 `has` 检查之后；`buildDependencies` 自身失败也清理 set。新增回归用例 `tests/desktopShell.test.ts#serializes concurrent invocations on the same profile via the active-set guard`，通过故意挂起 `buildDependencies` 的 Promise 复现旧 race，断言 `downloadFile` 只被调用一次、第二个请求收到 `already-running`。

### 8.2 CLI 锁清理掩盖真实错误（修复）

`scripts/download-models.ts` 旧逻辑：

```ts
} finally {
  await lockHandle.close()
  await rm(lockFile, { force: true })
}
```

如果 try 块里下载抛错，再让 `close()` 或 `rm()` 失败，新错误会**覆盖原始下载错误**的 stack（async/await 的 finally 行为），导致 CI 日志里只看到锁清理错误而非真正的下载失败原因。

修复：把两个清理调用各自包在 try/catch，把次级清理错误降级为 console.error，保留原始下载错误的传播。

### 8.3 验证

- `pnpm typecheck` -> exit 0
- `pnpm test --run` -> 38 files / 219 tests 全绿（新增 1 个并发竞态回归用例）
