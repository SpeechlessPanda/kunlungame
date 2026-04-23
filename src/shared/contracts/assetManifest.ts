/**
 * 资源清单（Asset Manifest） - Part 07 的资源位映射契约。
 *
 * 设计目标：
 *   1. 让占位素材与真实素材走同一张映射表，避免硬编码路径散落各处；
 *   2. 提供纯函数 `resolveAssetPath`，让 presentation 层无副作用地查询；
 *   3. 为后续真实素材准备一个 override 合流点（`mergeManifests`）。
 *
 * 不负责：不处理文件加载、不处理 IO、不感知 Vite/Electron 资源协议。
 */
import { z } from 'zod'

export const assetSlotTypeSchema = z.enum(['background', 'character'])
export const assetPlaceholderPolicySchema = z.enum([
    'empty-ok',
    'static-placeholder'
])

export const assetManifestEntrySchema = z.object({
    slotId: z.string().min(1),
    slotType: assetSlotTypeSchema,
    assetPath: z.string().min(1),
    placeholderPolicy: assetPlaceholderPolicySchema
})

export const assetManifestSchema = z.object({
    version: z.literal(1),
    entries: z.record(assetManifestEntrySchema)
})

export type AssetSlotType = z.infer<typeof assetSlotTypeSchema>
export type AssetManifestEntry = z.infer<typeof assetManifestEntrySchema>
export type AssetManifest = z.infer<typeof assetManifestSchema>

/**
 * 解析并校验清单，返回冻结后的副本。
 * 失败时抛出 ZodError，调用方负责翻译成运行时错误。
 */
export const parseAssetManifest = (input: unknown): AssetManifest => {
    const parsed = assetManifestSchema.parse(input)
    // 额外合同：entry 的 key 必须等于 slotId，避免两侧脱节。
    for (const [key, entry] of Object.entries(parsed.entries)) {
        if (key !== entry.slotId) {
            throw new Error(
                `Asset manifest entry key '${key}' does not match slotId '${entry.slotId}'.`
            )
        }
    }
    return parsed
}

/**
 * 纯查询：返回资源位对应的真实路径，不存在时返回 null。
 * 不做任何降级或回退，调用方自行决定如何呈现占位。
 */
export const resolveAssetPath = (
    manifest: AssetManifest | null | undefined,
    slotId: string
): string | null => {
    if (!manifest) {
        return null
    }
    const entry = manifest.entries[slotId]
    if (!entry) {
        return null
    }
    return entry.assetPath
}

/**
 * 合并两个清单：`override` 中的条目会覆盖 `base`。
 * 输出一个全新的清单对象，不会修改入参。
 * 主要用途：把真实素材清单叠加到默认占位清单上。
 */
export const mergeManifests = (
    base: AssetManifest,
    override: AssetManifest
): AssetManifest => {
    return {
        version: 1,
        entries: {
            ...base.entries,
            ...override.entries
        }
    }
}
