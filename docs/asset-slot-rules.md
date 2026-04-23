# 素材槽位规则

当前阶段不导入真实素材，但槽位命名和空态策略必须先固定，否则后续内容、UI 与资源管理会各写一套规则。

## 背景槽位

1. 命名格式：`background.<storyNodeId>.scene`
2. 当前占位策略：`empty-ok`
3. 背景槽位必须和 story node 的 `backgroundMode` 同步声明。
4. UI 只能消费 story node 已声明的背景模式，不能自行猜测是虚构图还是真实摄影。

## 角色槽位

1. 命名格式：`character.<characterId>.portrait`
2. 当前占位策略：`static-placeholder`
3. 即使角色素材为空，也必须保留稳定槽位，供后续空态渲染或静态占位图接入。

## 当前代码约束

1. `createBackgroundAssetSlot('kunlun-prologue', 'fictional')` 会生成 `background.kunlun-prologue.scene`。
2. `createCharacterAssetSlot('narrator')` 会生成 `character.narrator.portrait`。
3. 背景槽位允许 `assetPath = null`，角色槽位也允许 `assetPath = null`，但命名规则不能变。

## 设计原则

1. 槽位键名一旦被 Part 06 和 Part 07 消费，不应轻易更改。
2. 背景模式归主线内容负责，素材资源路径归资源管理负责，UI 只负责消费结果。
3. 空态是合同的一部分，不是异常分支。