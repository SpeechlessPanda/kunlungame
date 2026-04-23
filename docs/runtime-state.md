# 运行时状态与存档说明

Part 04 当前先建立一个最小稳定闭环：状态对象可序列化、选择只改变风格态度不改变主线分叉、文件存档可以创建与恢复。

## 状态结构

运行时状态当前包含：

1. `saveVersion`
2. `currentNodeId`
3. `turnIndex`
4. `attitudeScore`
5. `historySummary`
6. `readNodeIds`
7. `settings.bgmEnabled`

其中 `saveVersion` 当前固定为 `1`，用于后续最小版本演进。

## 态度值规则

1. 玩家选择 `align` 时，态度值 `+1`。
2. 玩家选择 `challenge` 时，态度值 `-1`。
3. 当前上下界为 `-3` 到 `3`。
4. 态度值只用于后续风格控制，不用于改变主线节点拓扑。

## 推进规则

1. 每次选择都会让 `turnIndex + 1`。
2. 如果当前节点存在 `nextNodeId`，则推进到下一个主线节点。
3. 如果当前节点已经是终点，状态层仍允许继续回合推进，但 `currentNodeId` 保持在终点节点。
4. 如果当前节点或下一节点不在 story outline 中，状态层会抛出明确错误，而不是静默推进。

## 存档仓储行为

1. 当存档文件不存在时，仓储会创建默认状态并返回 `created-default`。
2. 当存档文件存在且可解析时，仓储会返回 `loaded-existing`。
3. 当存档文件损坏或结构非法时，仓储会重建默认状态并返回 `reset-corrupted`。
4. 当存档结构合法但 `currentNodeId` 已不在当前 story outline 中时，仓储会直接抛出错误，不会静默清档。
5. 当前仓储只负责单文件读写，不负责多槽位与迁移链。

## 当前验证范围

1. `pnpm test -- tests/runtimeState.test.ts`
2. `pnpm test -- tests/desktopShell.test.ts tests/knowledgeCompilation.test.ts`
3. `pnpm test:e2e`
4. `pnpm build`