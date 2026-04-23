/**
 * 背景模式到资源位映射 (Part 07)。
 *
 * 故事节点声明了三种背景模式：`fictional`、`photographic`、`composite`。
 * 视觉层需要：
 *   1. 根据节点 id + 模式生成背景资源位；
 *   2. 在真实素材缺失时，返回一个稳定的占位描述，供渲染层绘制降级画面；
 *   3. 永远不能改写业务状态，只返回纯数据。
 */
import {
  createBackgroundAssetSlot,
  type BackgroundAssetSlot,
  type BackgroundMode,
  type StoryNode
} from '../shared/contracts/contentContracts.js'
import {
  resolveAssetPath,
  type AssetManifest
} from '../shared/contracts/assetManifest.js'

export interface BackgroundPresentation {
  slot: BackgroundAssetSlot
  /** 渲染层应展示的占位描述文本，永远非空。 */
  placeholderText: string
  /** 当前是否有真实素材可用。 */
  hasRealAsset: boolean
  /** 占位主色调 CSS token 名，供不同模式提供差异化视觉。 */
  paletteToken: 'palette-myth' | 'palette-heritage' | 'palette-bridge'
}

const paletteByMode: Record<BackgroundMode, BackgroundPresentation['paletteToken']> = {
  fictional: 'palette-myth',
  photographic: 'palette-heritage',
  composite: 'palette-bridge'
}

export const resolveBackgroundPresentation = (
  node: Pick<StoryNode, 'id' | 'backgroundMode' | 'backgroundHint'>,
  assetPath: string | null = null,
  manifest: AssetManifest | null = null
): BackgroundPresentation => {
  const slot = createBackgroundAssetSlot(node.id, node.backgroundMode)
  const explicitPath =
    typeof assetPath === 'string' && assetPath.length > 0 ? assetPath : null
  const resolvedPath = explicitPath ?? resolveAssetPath(manifest, slot.slotId)
  const hasRealAsset = typeof resolvedPath === 'string' && resolvedPath.length > 0
  const resolvedSlot: BackgroundAssetSlot = hasRealAsset
    ? { ...slot, assetPath: resolvedPath }
    : slot

  const placeholderText = node.backgroundHint

  return {
    slot: resolvedSlot,
    placeholderText,
    hasRealAsset,
    paletteToken: paletteByMode[node.backgroundMode]
  }
}

export interface CharacterPresentation {
  slotId: string
  assetPath: string | null
  hasRealAsset: boolean
  placeholderLabel: string
}

export const resolveCharacterPresentation = (
  characterId: string,
  label: string,
  assetPath: string | null = null,
  manifest: AssetManifest | null = null
): CharacterPresentation => {
  const slotId = `character.${characterId}.portrait`
  const explicitPath =
    typeof assetPath === 'string' && assetPath.length > 0 ? assetPath : null
  const resolvedPath = explicitPath ?? resolveAssetPath(manifest, slotId)
  const hasRealAsset = typeof resolvedPath === 'string' && resolvedPath.length > 0
  return {
    slotId,
    assetPath: hasRealAsset ? resolvedPath : null,
    hasRealAsset,
    placeholderLabel: label
  }
}
