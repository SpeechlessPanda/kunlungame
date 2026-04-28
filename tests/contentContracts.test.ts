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
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'

describe('parseStoryOutline', () => {
  it('accepts the minimal single-mainline story outline example', () => {
    const result = parseStoryOutline(minimalStoryOutline)

    expect(result.entryNodeId).toBe('kunlun-prologue')
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]?.backgroundMode).toBe('fictional')
  })

  it('accepts the approved mainline node fields for the real story outline', () => {
    const result = parseStoryOutline({
      entryNodeId: 'kunlun-threshold',
      nodes: [
        {
          id: 'kunlun-threshold',
          title: '昆仑初问',
          era: 'myth-origin',
          theme: '文明原点',
          coreQuestion: '我们为什么从昆仑开始回望自己？',
          summary: '建立文明回廊入口。',
          mustIncludeFacts: ['昆仑是世界中心'],
          retrievalKeywords: ['昆仑', '西王母'],
          recommendedFigures: ['西王母'],
          allowedKnowledgeTopics: ['myth-origin'],
          forbiddenFutureTopics: ['contemporary-return'],
          backgroundMode: 'fictional',
          backgroundHint: '远古雪山与天门',
          toneHint: '邀请式中文导览',
          characterCueIds: ['guide.kunlun'],
          minTurns: 1,
          nextNodeId: null
        }
      ]
    })

    const firstNode = result.nodes[0] as unknown as Record<string, unknown>

    expect(firstNode['era']).toBe('myth-origin')
    expect(firstNode['coreQuestion']).toBe('我们为什么从昆仑开始回望自己？')
    expect(firstNode['mustIncludeFacts']).toEqual(['昆仑是世界中心'])
    expect(firstNode['allowedKnowledgeTopics']).toEqual(['myth-origin'])
    expect(firstNode['characterCueIds']).toEqual(['guide.kunlun'])
    expect(firstNode['minTurns']).toBe(1)
  })

  it('accepts the canonical eight-node mainline outline source', () => {
    const result = parseStoryOutline(mainlineStoryOutline)

    expect(result.entryNodeId).toBe('kunlun-threshold')
    expect(result.nodes).toHaveLength(8)
    expect(result.nodes[0]?.id).toBe('kunlun-threshold')
    expect(result.nodes[7]?.id).toBe('contemporary-return')
  })

  it('keeps Ming and Qing compilation anchors historically separated', () => {
    const fusionNode = mainlineStoryOutline.nodes.find((node) => node.id === 'fusion-and-refinement')

    expect(fusionNode?.mustIncludeFacts.join('\n')).not.toContain('明清之交，《永乐大典》《四库全书》')
    expect(fusionNode?.mustIncludeFacts).toContain(
      '明代《永乐大典》与清代《四库全书》分别代表不同时期的大规模文献整理'
    )
  })

  it('keeps Banquan and Zhuolu battles distinct in civilization roots facts', () => {
    const civilizationNode = mainlineStoryOutline.nodes.find((node) => node.id === 'civilization-roots')
    const facts = civilizationNode?.mustIncludeFacts.join('\n') ?? ''

    expect(facts).toContain('阪泉之战')
    expect(facts).toContain('涿鹿之战')
    expect(facts).toContain('蚩尤')
    expect(facts).not.toContain('黄帝与炎帝的联盟-冲突-合流')
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

  it('accepts the approved eight-node single-mainline chain', () => {
    const issues = validateStoryNodeChain(mainlineStoryOutline)

    expect(issues).toEqual([])
    expect(mainlineStoryOutline.nodes.map((node) => node.id)).toEqual([
      'kunlun-threshold',
      'creation-myths',
      'civilization-roots',
      'order-and-thought',
      'empire-and-openness',
      'fusion-and-refinement',
      'rupture-and-guardianship',
      'contemporary-return'
    ])
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

  it('keeps the existing portrait slot helper unchanged while later adding real mainline cues', () => {
    const portraitSlot = createCharacterAssetSlot('narrator')

    expect(portraitSlot.slotId).toBe('character.narrator.portrait')
    expect(portraitSlot.placeholderPolicy).toBe('static-placeholder')
  })
})