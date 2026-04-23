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
import characterSilhouetteUrl from './placeholders/character-silhouette.svg?url'

export const defaultAssetManifest: AssetManifest = parseAssetManifest({
    version: 1,
    entries: {
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
            assetPath: characterSilhouetteUrl,
            placeholderPolicy: 'static-placeholder'
        }
    }
})
