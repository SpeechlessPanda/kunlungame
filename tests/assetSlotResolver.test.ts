import { describe, expect, it } from 'vitest'
import type { StoryNode } from '../src/shared/contracts/contentContracts.js'
import {
  resolveBackgroundPresentation,
  resolveCharacterPresentation
} from '../src/presentation/assetSlotResolver.js'
import type { AssetManifest } from '../src/shared/contracts/assetManifest.js'

const makeNode = (overrides: Partial<StoryNode> = {}): StoryNode => ({
  id: 'kunlun-prologue',
  title: '昆仑开篇',
  era: 'myth-origin',
  theme: '神话源流',
  coreQuestion: '占位问题',
  summary: '占位',
  mustIncludeFacts: ['昆仑作为神话源头'],
  retrievalKeywords: ['昆仑'],
  recommendedFigures: ['西王母'],
  allowedKnowledgeTopics: ['kunlun'],
  forbiddenFutureTopics: [],
  backgroundMode: 'fictional',
  backgroundHint: '云海与雪山',
  toneHint: '庄严',
  characterCueIds: [],
  minTurns: 1,
  nextNodeId: null,
  ...overrides
})

describe('resolveBackgroundPresentation', () => {
  it('maps fictional to myth palette and uses hint as placeholder', () => {
    const presentation = resolveBackgroundPresentation(makeNode())
    expect(presentation.slot.slotId).toBe('background.kunlun-prologue.scene')
    expect(presentation.slot.mode).toBe('fictional')
    expect(presentation.paletteToken).toBe('palette-myth')
    expect(presentation.placeholderText).toBe('云海与雪山')
    expect(presentation.hasRealAsset).toBe(false)
    expect(presentation.slot.assetPath).toBeNull()
  })

  it('maps photographic to heritage palette', () => {
    const presentation = resolveBackgroundPresentation(
      makeNode({ backgroundMode: 'photographic', backgroundHint: '礼乐城阙' })
    )
    expect(presentation.slot.mode).toBe('photographic')
    expect(presentation.paletteToken).toBe('palette-heritage')
  })

  it('maps composite to bridge palette', () => {
    const presentation = resolveBackgroundPresentation(
      makeNode({ backgroundMode: 'composite', backgroundHint: '神话与历史并置' })
    )
    expect(presentation.paletteToken).toBe('palette-bridge')
  })

  it('attaches a real asset path when provided', () => {
    const presentation = resolveBackgroundPresentation(
      makeNode(),
      'file:///bg.webp'
    )
    expect(presentation.hasRealAsset).toBe(true)
    expect(presentation.slot.assetPath).toBe('file:///bg.webp')
  })

  it('never returns an empty placeholder text even when asset is present', () => {
    const presentation = resolveBackgroundPresentation(
      makeNode({ backgroundHint: '山水' }),
      'file:///bg.webp'
    )
    expect(presentation.placeholderText.length).toBeGreaterThan(0)
  })
})

describe('resolveCharacterPresentation', () => {
  it('returns placeholder label when no asset path is provided', () => {
    const presentation = resolveCharacterPresentation('xiwangmu', '西王母')
    expect(presentation.slotId).toBe('character.xiwangmu.portrait')
    expect(presentation.hasRealAsset).toBe(false)
    expect(presentation.assetPath).toBeNull()
    expect(presentation.placeholderLabel).toBe('西王母')
  })

  it('accepts real asset paths', () => {
    const presentation = resolveCharacterPresentation(
      'xiwangmu',
      '西王母',
      'file:///xwm.webp'
    )
    expect(presentation.hasRealAsset).toBe(true)
    expect(presentation.assetPath).toBe('file:///xwm.webp')
  })
})

describe('asset manifest integration', () => {
  const manifest: AssetManifest = {
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

  const baseNode: StoryNode = {
    id: 'kunlun-prologue',
    title: '昆仑开篇',
    era: 'myth-origin',
    theme: '神话源流',
    coreQuestion: '占位问题',
    summary: '占位',
    mustIncludeFacts: ['昆仑作为神话源头'],
    retrievalKeywords: ['昆仑'],
    recommendedFigures: ['西王母'],
    allowedKnowledgeTopics: ['kunlun'],
    forbiddenFutureTopics: [],
    backgroundMode: 'fictional',
    backgroundHint: '云海与雪山',
    toneHint: '庄严',
    characterCueIds: [],
    minTurns: 1,
    nextNodeId: null
  }

  it('uses the manifest entry when no explicit asset path is provided (background)', () => {
    const presentation = resolveBackgroundPresentation(baseNode, null, manifest)
    expect(presentation.hasRealAsset).toBe(true)
    expect(presentation.slot.assetPath).toBe('/placeholders/bg-myth.svg')
  })

  it('prefers the explicit asset path over the manifest entry (background)', () => {
    const presentation = resolveBackgroundPresentation(
      baseNode,
      'file:///explicit.webp',
      manifest
    )
    expect(presentation.slot.assetPath).toBe('file:///explicit.webp')
  })

  it('falls back to empty placeholder when manifest has no matching slot (background)', () => {
    const otherNode: StoryNode = { ...baseNode, id: 'kunlun-unknown' }
    const presentation = resolveBackgroundPresentation(otherNode, null, manifest)
    expect(presentation.hasRealAsset).toBe(false)
    expect(presentation.slot.assetPath).toBeNull()
  })

  it('uses the manifest entry when no explicit asset path is provided (character)', () => {
    const presentation = resolveCharacterPresentation(
      'narrator',
      '叙述者',
      null,
      manifest
    )
    expect(presentation.hasRealAsset).toBe(true)
    expect(presentation.assetPath).toBe('/placeholders/character-silhouette.svg')
  })

  it('prefers the explicit asset path over the manifest entry (character)', () => {
    const presentation = resolveCharacterPresentation(
      'narrator',
      '叙述者',
      'file:///narrator.webp',
      manifest
    )
    expect(presentation.assetPath).toBe('file:///narrator.webp')
  })

  it('falls back to empty placeholder when manifest has no matching character slot', () => {
    const presentation = resolveCharacterPresentation(
      'unknown-character',
      '未知',
      null,
      manifest
    )
    expect(presentation.hasRealAsset).toBe(false)
    expect(presentation.assetPath).toBeNull()
  })
})
