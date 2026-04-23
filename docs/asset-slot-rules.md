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

## 资源清单（Asset Manifest）

为了让占位素材和未来的真实素材走同一条映射管线，项目在 `src/shared/contracts/assetManifest.ts` 中声明了统一的清单合同：

```ts
AssetManifest = {
  version: 1,
  entries: Record<string, {
    slotId: string
    slotType: 'background' | 'character'
    assetPath: string
    placeholderPolicy: 'empty-ok' | 'static-placeholder'
  }>
}
```

约束与辅助函数：

1. `entries` 的 key 必须与条目的 `slotId` 完全一致；校验失败会抛错，避免两侧脱节。
2. `resolveAssetPath(manifest, slotId)` 为纯查询，命中返回路径，未命中或清单为 null 时返回 `null`。
3. `mergeManifests(base, override)` 返回新对象，override 中同键条目会覆盖 base，用于后续把真实素材叠加到默认占位上。
4. `resolveBackgroundPresentation(node, assetPath?, manifest?)` 与 `resolveCharacterPresentation(characterId, label, assetPath?, manifest?)` 支持传入清单；显式 `assetPath` 的优先级高于清单。

## 占位素材目录

1. 默认占位清单位于 `src/renderer/assets/manifest.ts`，通过 Vite 的 `?url` 静态资源导入把 SVG 文件映射到浏览器可加载路径。
2. 占位 SVG 统一存放在 `src/renderer/assets/placeholders/`，当前包括：
   - `background-fictional.svg` — 神话向（`palette-myth`）；
   - `background-photographic.svg` — 历史向（`palette-heritage`）；
   - `background-composite.svg` — 虚实复合向（`palette-bridge`）；
   - `character-silhouette.svg` — 通用角色剪影。
3. 所有占位 SVG 保持 ≤ 4 KB，仅使用项目调色板 `#0F172A` / `#D97706` / `#3F9A6A` / `#C55A48`，不在图形内嵌文字标签（模式文字由 UI 覆盖层提供）。
4. 当真实素材交付时，在不修改 `manifest.ts` 的前提下，调用方可以用 `mergeManifests(defaultAssetManifest, realManifest)` 得到合并后的清单；文件本体落盘位置由后续资源管理阶段统一规定。