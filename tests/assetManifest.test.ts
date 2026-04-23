import { describe, expect, it } from 'vitest'
import {
    mergeManifests,
    parseAssetManifest,
    resolveAssetPath,
    type AssetManifest
} from '../src/shared/contracts/assetManifest.js'

const validManifest: AssetManifest = {
    version: 1,
    entries: {
        'background.kunlun-prologue.scene': {
            slotId: 'background.kunlun-prologue.scene',
            slotType: 'background',
            assetPath: '/placeholders/bg-myth.svg',
            placeholderPolicy: 'static-placeholder'
        },
        'character.narrator.portrait': {
            slotId: 'character.narrator.portrait',
            slotType: 'character',
            assetPath: '/placeholders/character-silhouette.svg',
            placeholderPolicy: 'static-placeholder'
        }
    }
}

describe('parseAssetManifest', () => {
    it('accepts a well-formed manifest', () => {
        const parsed = parseAssetManifest(validManifest)
        expect(parsed.version).toBe(1)
        expect(Object.keys(parsed.entries)).toHaveLength(2)
    })

    it('rejects manifest when version is wrong', () => {
        expect(() =>
            parseAssetManifest({
                version: 2,
                entries: {}
            })
        ).toThrow()
    })

    it('rejects manifest when slotType is unknown', () => {
        expect(() =>
            parseAssetManifest({
                version: 1,
                entries: {
                    'foo.bar': {
                        slotId: 'foo.bar',
                        slotType: 'audio',
                        assetPath: '/x.svg',
                        placeholderPolicy: 'empty-ok'
                    }
                }
            })
        ).toThrow()
    })

    it('rejects manifest when assetPath is empty', () => {
        expect(() =>
            parseAssetManifest({
                version: 1,
                entries: {
                    'background.x.scene': {
                        slotId: 'background.x.scene',
                        slotType: 'background',
                        assetPath: '',
                        placeholderPolicy: 'static-placeholder'
                    }
                }
            })
        ).toThrow()
    })

    it('rejects manifest when entry key does not match slotId', () => {
        expect(() =>
            parseAssetManifest({
                version: 1,
                entries: {
                    'not-matching-key': {
                        slotId: 'background.kunlun-prologue.scene',
                        slotType: 'background',
                        assetPath: '/x.svg',
                        placeholderPolicy: 'static-placeholder'
                    }
                }
            })
        ).toThrow(/does not match slotId/)
    })
})

describe('resolveAssetPath', () => {
    it('returns the asset path for an existing slot', () => {
        expect(
            resolveAssetPath(validManifest, 'background.kunlun-prologue.scene')
        ).toBe('/placeholders/bg-myth.svg')
    })

    it('returns null for a missing slot', () => {
        expect(resolveAssetPath(validManifest, 'background.unknown.scene')).toBeNull()
    })

    it('returns null when manifest is null', () => {
        expect(resolveAssetPath(null, 'background.kunlun-prologue.scene')).toBeNull()
    })

    it('returns null when manifest is undefined', () => {
        expect(
            resolveAssetPath(undefined, 'background.kunlun-prologue.scene')
        ).toBeNull()
    })
})

describe('mergeManifests', () => {
    it('returns a new manifest where override entries win', () => {
        const override: AssetManifest = {
            version: 1,
            entries: {
                'background.kunlun-prologue.scene': {
                    slotId: 'background.kunlun-prologue.scene',
                    slotType: 'background',
                    assetPath: '/real/prologue.webp',
                    placeholderPolicy: 'static-placeholder'
                }
            }
        }
        const merged = mergeManifests(validManifest, override)
        expect(
            resolveAssetPath(merged, 'background.kunlun-prologue.scene')
        ).toBe('/real/prologue.webp')
        // Untouched entries survive.
        expect(resolveAssetPath(merged, 'character.narrator.portrait')).toBe(
            '/placeholders/character-silhouette.svg'
        )
    })

    it('does not mutate the base manifest', () => {
        const override: AssetManifest = {
            version: 1,
            entries: {
                'background.kunlun-prologue.scene': {
                    slotId: 'background.kunlun-prologue.scene',
                    slotType: 'background',
                    assetPath: '/real/prologue.webp',
                    placeholderPolicy: 'static-placeholder'
                }
            }
        }
        mergeManifests(validManifest, override)
        expect(
            resolveAssetPath(validManifest, 'background.kunlun-prologue.scene')
        ).toBe('/placeholders/bg-myth.svg')
    })
})
