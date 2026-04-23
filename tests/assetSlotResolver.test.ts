import { describe, expect, it } from 'vitest'
import type { StoryNode } from '../src/shared/contracts/contentContracts.js'
import {
  resolveBackgroundPresentation,
  resolveCharacterPresentation
} from '../src/presentation/assetSlotResolver.js'

const makeNode = (overrides: Partial<StoryNode> = {}): StoryNode => ({
  id: 'kunlun-prologue',
  title: '昆仑开篇',
  theme: '神话源流',
  summary: '占位',
  retrievalKeywords: ['昆仑'],
  backgroundMode: 'fictional',
  backgroundHint: '云海与雪山',
  toneHint: '庄严',
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
