# Part 08 Spec: 端到端集成与验收层

## Execution Status

Status: in progress (real-model smoke deferred until assets delivered)

Completed to date:

1. Part 01–07 全部完成 UI + 非 UI 实施并通过聚焦验证；Part 07 视觉层只剩最终素材未绑定（占位管线已就位）。
2. 非 UI 全管线集成测试已落地：`tests/integrationMainlineLoop.test.ts` 串联 canonical mainline、知识检索、对话编排、运行时状态、存档仓储，验证 chunk→options→complete 事件顺序、`readNodeIds` 驱动摘要重建、态度值钳制、节点推进、存档恢复。
3. 黑盒 / E2E：`tests/e2e/rendererShell.spec.ts` 覆盖空态 / 流式 / 选项 / 错误重试 / 背景模式切换 / 键盘快捷键 / 焦点陷阱 / 移动端 tap target / reduced-motion / 性能预算，共 12 场景全部通过。
4. 真实本地模型 IPC 通道已接通：`src/modeling/mainlineTurnRunner.ts` 把 `localDialogueDependencies` 泛化为任意节点任意运行时状态的单轮执行器；`desktop:run-mainline-turn` 在 `electron/main/index.ts` 注册，`electron/preload/index.ts` 暴露 `runMainlineTurn`，`src/renderer/adapters/rendererDialogueDependencies.ts` 提供 `createBridgeDialogueDependenciesFactory`，`src/renderer/App.vue` 在 `useMockStream(false)` 时切到 bridge 工厂。失败分支 `model-missing` / `model-load-failed` / `orchestration-failed` 均可被 UI 感知。
5. 最近一次 fresh 全量验证：`pnpm typecheck` = 0，`pnpm test --run` = 30 files / 150 tests pass，`pnpm test:e2e` = 12/12 pass，`pnpm knowledge:compile` 可稳定再生产结构化产物。
6. 发布前审计模板：`docs/audits/2026-release-audit-template.md` 已建立，覆盖依赖 / 测试 / 构建 / 冒烟 / 性能 / 文档 / 内容七项检查。

Currently blocked or deferred:

1. 真实本地模型（GGUF）文件与真实背景图片仍未就位，因此尚未完成不少于 5 分钟的桌面端真实协作闭环试玩。
2. 正式发布前审计记录尚未填充具体结果。

## 1. 目标

把前 7 个部分串成一个可验证的首版闭环，并将验收标准、覆盖率门槛和发布前检查条件落到实际可执行流程。

## 2. 范围

1. 端到端链路串联。
2. 黑盒与白盒测试补齐。
3. 覆盖率复核。
4. 五分钟体验冒烟验证。
5. 文档同步与发布前审计入口。

## 3. 明确不做

1. 不新增核心业务契约。
2. 不重写前面部分的职责分界。
3. 不引入多分支剧情或开放输入模式。

## 4. 依赖与前置

1. 强依赖 Part 01 至 Part 07 全部完成。
2. 依赖项目级 instructions 中的测试和审计规则。
3. 在当前执行状态下，Part 02 至 Part 05 的 non-UI 前置已满足，但 Part 06 与 renderer-side 的 Part 07 仍未满足。

## 5. 契约与边界

1. 集成层只消费已定义契约，不应再发明新字段。
2. 验收必须覆盖单主线、流式输出、动态选项、风格差异、存档恢复。
3. 黑盒和白盒测试都必须存在。

## 6. 关键流程

1. 启动应用。
2. 进入当前主线节点。
3. 检索知识并触发 AI 流式回复。
4. UI 逐步显示文本。
5. 玩家选择附和或反驳选项。
6. 状态更新、背景保持一致、可继续下一轮。
7. 中断后恢复。
8. 完成一轮不少于 5 分钟的闭环体验。

## 7. 错误处理要求

1. 任一子系统失败时，要能定位到具体层级。
2. AI 不可用时，至少能验证错误提示与重试路径。
3. 集成失败不能靠手工跳过关键验收条件来算通过。

## 8. 测试策略

黑盒测试：

1. 玩家完整体验一轮单主线流程。
2. 玩家能看到流式文本和两个动态选项。
3. 不同态度选择会影响风格但不改变主线事实。
4. 存档后可恢复。

白盒测试：

1. 检索、状态、提示词、流事件、组件事件都具备针对性单测。
2. 覆盖率达到整体 80%、核心模块 90%。

## 9. 验收条件

1. 应用能在 Windows 桌面端运行。
2. 单主线体验可持续不少于 5 分钟。
3. 输出是流式而不是整段一次性出现。
4. 两个按钮每轮都与上下文相关。
5. 背景模式与主线内容一致。
6. 黑盒、白盒、覆盖率要求都满足。
7. 文档和实施计划与当前实现保持同步。

## 10. Deferred After Part 05

1. Part 06 UI shell。
2. Part 07 renderer-side visual stage and asset presentation。
3. 主线 + 本地模型的一轮真实协作冒烟，以及不少于 5 分钟的桌面端闭环试玩。
4. 覆盖率门槛复核与正式发布前审计记录。

## 11. 交付物

1. 端到端测试。
2. 最终验收清单。
3. 覆盖率报告。
4. 发布前审计记录模板或文档。

## 12. 风险与回滚边界

1. 若没有专门的集成层 spec，团队很容易在前面各部分都“看起来完成”但实际上不能形成闭环。
2. 若覆盖率和验收标准不在这里写死，最终会把“能跑”误当成“可交付”。
