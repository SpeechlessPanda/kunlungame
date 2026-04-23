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
4. story node 只声明 `characterCueIds`，由运行时再映射到具体资源槽位。
5. 为后续 3D 角色资产预留并行槽位：`character.<characterId>.runtime-3d`。

## 当前代码约束

1. `createBackgroundAssetSlot('kunlun-prologue', 'fictional')` 会生成 `background.kunlun-prologue.scene`。
2. `createCharacterAssetSlot('narrator')` 会生成 `character.narrator.portrait`。
3. `characterCueIds` 例如 `guide.kunlun` 只是内容层 cue，不等于最终文件名。
4. 背景槽位允许 `assetPath = null`，角色槽位也允许 `assetPath = null`，但命名规则不能变。

## Character Cue Rules

1. `guide.kunlun`：文化向导占位 cue，当前 canonical mainline 全节点可引用。
2. `player.memory-self`：现代青年主角占位 cue，预留给后续自我映照或回声场景。
3. story node 可以先声明 cue，再由后续运行时映射到 `portrait` 或 `runtime-3d` 资源槽位。
4. cue id 不得包含渲染层路径、文件扩展名或平台相关目录信息。
5. cue id 一旦进入 story outline 与 generated storyOutline.json，就应被视为稳定合同字段。

## 设计原则

1. 槽位键名一旦被 Part 06 和 Part 07 消费，不应轻易更改。
2. 背景模式归主线内容负责，素材资源路径归资源管理负责，UI 只负责消费结果。
3. 空态是合同的一部分，不是异常分支。
4. 内容层先固定 cue 与 slot 规则，再在后续阶段分别接入 portrait 和 runtime-3d 资产。