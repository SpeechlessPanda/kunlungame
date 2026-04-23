import { describe, expect, it } from 'vitest'
import {
  backgroundModeSchema,
  createBackgroundAssetSlot,
  createCharacterAssetSlot,
  minimalKnowledgeEntries,
  minimalStoryOutline,
  parseKnowledgeEntries,
  parseStoryOutline,
  validateStoryNodeChain
} from '../src/shared/contracts/contentContracts.js'

describe('parseStoryOutline', () => {
  it('accepts the minimal single-mainline story outline example', () => {
    const result = parseStoryOutline(minimalStoryOutline)

    expect(result.entryNodeId).toBe('kunlun-prologue')
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]?.backgroundMode).toBe('fictional')
  })
})

describe('parseKnowledgeEntries', () => {
  it('accepts the minimal knowledge entry example', () => {
    const result = parseKnowledgeEntries(minimalKnowledgeEntries)

    expect(result).toHaveLength(1)
    expect(result[0]?.storyNodeIds).toEqual(['kunlun-prologue'])
  })
})

describe('backgroundModeSchema', () => {
  it('rejects undefined background modes', () => {
    expect(backgroundModeSchema.safeParse('video')).toMatchObject({
      success: false
    })
  })
})

describe('validateStoryNodeChain', () => {
  it('accepts a legal single-node terminal chain', () => {
    const issues = validateStoryNodeChain(minimalStoryOutline)

    expect(issues).toEqual([])
  })

  it('reports a missing next node target during static validation', () => {
    const issues = validateStoryNodeChain({
      entryNodeId: 'kunlun-prologue',
      nodes: [
        {
          ...minimalStoryOutline.nodes[0],
          nextNodeId: 'missing-node'
        }
      ]
    })

    expect(issues).toContain("Story node 'kunlun-prologue' points to missing nextNodeId 'missing-node'.")
  })
})

describe('asset slot helpers', () => {
  it('creates stable background and character slot identifiers', () => {
    const backgroundSlot = createBackgroundAssetSlot('kunlun-prologue', 'fictional')
    const characterSlot = createCharacterAssetSlot('narrator')

    expect(backgroundSlot.slotId).toBe('background.kunlun-prologue.scene')
    expect(backgroundSlot.mode).toBe('fictional')
    expect(characterSlot.slotId).toBe('character.narrator.portrait')
    expect(characterSlot.placeholderPolicy).toBe('static-placeholder')
  })
})