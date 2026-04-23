# Part 07 Spec: 视觉表现层与资源位系统

## Execution Status

Status: completed (pending real-asset delivery)

Completed to date:

1. 非 UI 的角色 cue 规则已稳定：`characterCueIds` 先映射稳定 cue，再映射 portrait 或 runtime-3d 槽位，`guide.kunlun` / `player.memory-self` 已写入共享资产规则文档。
2. 渲染侧 stage 组件齐全：`BackgroundStage`、`CharacterSlot`、`BgmPlayer` 已落地，消费 `resolveBackgroundPresentation` / `resolveCharacterPresentation` 的占位 / 真实双分支。
3. 资源位合同 `AssetManifest` + 默认占位清单 `defaultAssetManifest` 已接入 App.vue，四张 ≤4 KB 占位 SVG 覆盖三种背景模式和 narrator 角色。
4. 背景切换逻辑按 `backgroundMode` 切换模式标签 overlay，E2E 已覆盖节点推进时模式变化。
5. 全量验证通过：`pnpm typecheck`、`pnpm test`（143/143）、`pnpm test:e2e`（12/12）。

Currently blocked or deferred:

1. 最终 2D 角色立绘、3D 运行时模型和真实背景图片仍未绑定；管线已铺好，等用户交付素材后以 `mergeManifests` 覆盖占位即可。
2. 真实 BGM 轨道与音量曲线需要音频资源，占位组件默认禁用开关，主界面不阻塞。
3. 3D 运行时角色 (`character.<id>.runtime-3d`) 的注册等待 `docs/superpowers/specs/2026-04-23-character-3d-asset-integration-design.md` 完成可播放阶段后再加入默认清单。

## 1. 目标

在不依赖最终素材文件本体的前提下，先建立背景模式切换、资源位占位、BGM 占位和视觉表现接入规则。

## 2. 范围

1. 背景图模式渲染入口。
2. `fictional`、`photographic`、`composite` 三种模式的前端消费规则。
3. 角色资源位占位与空态。
4. BGM 播放器占位与基础控制。
5. 背景切换和转场钩子。

## 3. 明确不做

1. 不提交最终背景素材文件。
2. 不确定最终角色立绘定稿。
3. 不生成主线内容本身。

## 4. 依赖与前置

1. 依赖 Part 02 的背景模式契约。
2. 依赖 Part 06 的 UI 容器。
3. 为 Part 08 提供完整表现层接线。

## 5. 契约与边界

1. 资源位可以为空，但渲染逻辑不能空缺。
2. 背景图选择逻辑必须从 story node 的 `backgroundMode` 与 `backgroundHint` 出发。
3. BGM 必须可禁用。
4. 视觉层只负责表现，不改变剧情状态。
5. story node 中的 `characterCueIds` 必须先映射到稳定 cue，再映射到具体 portrait 或 runtime-3d 槽位。

## 6. 关键流程

1. 根据当前节点读取背景模式。
2. 选择对应资源位或占位画面。
3. 根据 `characterCueIds` 解析当前角色 cue。
4. 执行背景切换与过渡。
5. 挂载角色占位。
6. 控制 BGM 开关与基础音量。

## 7. 错误处理要求

1. 资源缺失时使用占位而不是白屏。
2. 模式值与资源位不匹配时输出调试提示。
3. 音频文件不存在时不能阻断主界面渲染。
4. cue id 未映射到资源槽位时，必须回落到角色空态而不是报错中断。

## 8. 测试策略

黑盒测试：

1. 切换不同 `backgroundMode` 时，界面有明确变化。
2. 没有真实图片时，占位资源仍可正常显示。
3. BGM 开关生效。

白盒测试：

1. 模式到资源位的映射逻辑正确。
2. 视觉层不会改写业务状态。
3. 缺失素材时降级逻辑稳定。
4. `characterCueIds` 到 portrait 或 runtime-3d 槽位的映射规则稳定。

## 9. 验收条件

1. 即使没有最终素材文件，界面也能体现三类背景模式的不同入口。
2. 主线节点切换时，背景切换逻辑可工作。
3. 角色与音频资源位具备后续替换能力。
4. 背景模式与主线内容的关系在运行时得到体现。
5. canonical 主线里出现的 cue id 不会直接绑定平台路径或最终资产文件名。

## 10. 交付物

1. 背景舞台组件。
2. 资源位命名与占位策略。
3. BGM 占位组件。
4. 视觉层测试与占位演示。

## 11. Deferred After Part 05

1. Part 06 UI shell。
2. Part 07 renderer-side stage components。
3. Part 08 end-to-end acceptance and release audit。

## 12. 风险与回滚边界

1. 若先写死真实素材路径，后续用户交付素材时会大面积返工。
2. 若视觉模式不服从主线节点定义，内容与画面会持续失配。
3. 若 cue 规则不稳定，后续 2D 立绘与 3D 角色接入会同时返工。

## 13. 实施进度（feat/ui-shell）

已完成：

1. 资源位解析：`resolveBackgroundPresentation` / `resolveCharacterPresentation` 以 `backgroundMode` + `backgroundHint` 为输入，无素材时回退到三类 palette（myth / heritage / bridge）渐变占位 + 模式标签。
2. 背景舞台：`BackgroundStage` 根据 `hasRealAsset` 自动切换真实图片与占位渐变，保留可访问性标签。
3. 角色位：`CharacterSlot` 支持立绘与剪影占位，保持 3:4 锚定，不拦截指针事件。
4. BGM：`createBgmController` + `BgmPlayer` 与 `SettingsPanel` 联动；音频源不存在时开关自动禁用，主界面不受阻断。
5. 设计令牌：`src/renderer/styles/tokens.css` 统一色板、字体、间距、动画与 `prefers-reduced-motion` 降级。
6. 测试：`assetSlotResolver`、`bgmController` 白盒测试；E2E 覆盖“节点切换导致背景模式标签变化”“无源时 BGM 开关保持禁用”。

有意延后：

1. 真实背景与立绘素材的接入（等待资源交付）。
2. 正式 BGM 轨道与音量曲线（等待音频资源）。
3. 转场动画细节（待视觉定稿后补）。

## 14. 实施进度（feat/asset-placeholder-pipeline）

已完成：

1. 资源清单合同：新增 `src/shared/contracts/assetManifest.ts`，声明 `AssetManifest` Zod schema、纯函数 `resolveAssetPath` 与合流工具 `mergeManifests`；entries key 必须与 `slotId` 完全一致，否则解析抛错。
2. 占位 SVG：`src/renderer/assets/placeholders/` 下提供 `background-fictional.svg`、`background-photographic.svg`、`background-composite.svg`、`character-silhouette.svg` 四张图，统一调色板 `#0F172A`/`#D97706`/`#3F9A6A`/`#C55A48`，均 ≤ 4 KB，无内嵌文字标签。
3. 默认清单：`src/renderer/assets/manifest.ts` 通过 Vite `?url` 导入把当前 demo 的三个节点与 `narrator` 角色映射到占位 SVG，真实素材上线时以 `mergeManifests` 覆盖即可。
4. Resolver 对齐：`resolveBackgroundPresentation` / `resolveCharacterPresentation` 新增可选 `manifest` 参数，优先级为 `explicit assetPath > manifest > 空态`，旧的二参调用保持行为不变。
5. 视觉层：`BackgroundStage` 把模式标签抽到独立 overlay，与占位 / 真实图片两种状态共存，E2E 里 `background-mode-label` 仍然稳定可见。
6. App 接线：`App.vue` 在不改动 GameShell 合同的前提下读取默认清单，并把解析后的 `backgroundAssetPath` 与 `character.assetPath` 传入。
7. 测试：新增 `tests/assetManifest.test.ts`（schema hit/miss/invalid、合流不可变等 10 个用例），扩充 `tests/assetSlotResolver.test.ts` 的 manifest 集成分组；保留既有用例全部通过。

有意延后：

1. 真实背景与立绘素材仍未接入（仅铺好管线）。
2. 3D 运行时角色 (`character.<id>.runtime-3d`) 槽位暂未进入默认清单，等 Part 03D 推进到可播放阶段后再注册。
3. BGM 等音频资源未纳入当前清单合同，后续若要合流，需要独立的 slotType 扩展。
