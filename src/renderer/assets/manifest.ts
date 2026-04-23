/**
 * 渲染层默认资源清单。
 *
 * 这里只负责把当前 demo 的 story node 槽位映射到占位 SVG。
 * 当真实素材交付时，可通过 `mergeManifests` 合成新的清单，不必修改本文件。
 */
import {
    parseAssetManifest,
    type AssetManifest
} from '../../shared/contracts/assetManifest.js'

// Vite 会把 ?url 后缀的静态资源编译成浏览器可直接加载的 URL 字符串。
import backgroundFictionalUrl from './placeholders/background-fictional.svg?url'
import backgroundPhotographicUrl from './placeholders/background-photographic.svg?url'
import backgroundCompositeUrl from './placeholders/background-composite.svg?url'
import characterKunlunUrl from './placeholders/character-kunlun-portrait.svg?url'

export const defaultAssetManifest: AssetManifest = parseAssetManifest({
    version: 1,
    entries: {
        // —— canonical 8 节点（Part 02 · mainlineOutline） —— //
        'background.kunlun-threshold.scene': {
            slotId: 'background.kunlun-threshold.scene',
            slotType: 'background',
            assetPath: backgroundFictionalUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.creation-myths.scene': {
            slotId: 'background.creation-myths.scene',
            slotType: 'background',
            assetPath: backgroundFictionalUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.civilization-roots.scene': {
            slotId: 'background.civilization-roots.scene',
            slotType: 'background',
            assetPath: backgroundFictionalUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.order-and-thought.scene': {
            slotId: 'background.order-and-thought.scene',
            slotType: 'background',
            assetPath: backgroundCompositeUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.empire-and-openness.scene': {
            slotId: 'background.empire-and-openness.scene',
            slotType: 'background',
            assetPath: backgroundPhotographicUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.fusion-and-refinement.scene': {
            slotId: 'background.fusion-and-refinement.scene',
            slotType: 'background',
            assetPath: backgroundCompositeUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.rupture-and-guardianship.scene': {
            slotId: 'background.rupture-and-guardianship.scene',
            slotType: 'background',
            assetPath: backgroundPhotographicUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.contemporary-return.scene': {
            slotId: 'background.contemporary-return.scene',
            slotType: 'background',
            assetPath: backgroundCompositeUrl,
            placeholderPolicy: 'static-placeholder'
        },
        // —— 旧 demo 节点（保留 fallback） —— //
        'background.kunlun-prologue.scene': {
            slotId: 'background.kunlun-prologue.scene',
            slotType: 'background',
            assetPath: backgroundFictionalUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.kunlun-rites.scene': {
            slotId: 'background.kunlun-rites.scene',
            slotType: 'background',
            assetPath: backgroundPhotographicUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'background.kunlun-dialogue.scene': {
            slotId: 'background.kunlun-dialogue.scene',
            slotType: 'background',
            assetPath: backgroundCompositeUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'character.narrator.portrait': {
            slotId: 'character.narrator.portrait',
            slotType: 'character',
            assetPath: characterKunlunUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'character.kunlun.portrait': {
            slotId: 'character.kunlun.portrait',
            slotType: 'character',
            assetPath: characterKunlunUrl,
            placeholderPolicy: 'static-placeholder'
        },
        'character.guide.kunlun.portrait': {
            slotId: 'character.guide.kunlun.portrait',
            slotType: 'character',
            assetPath: characterKunlunUrl,
            placeholderPolicy: 'static-placeholder'
        }
    }
})
