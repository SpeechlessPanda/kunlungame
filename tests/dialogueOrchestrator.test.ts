import { describe, expect, it } from 'vitest'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import { orchestrateDialogue } from '../src/modeling/dialogueOrchestrator.js'

describe('orchestrateDialogue', () => {
  it('emits chunk, options, and complete events in order', async () => {
    const events = []

    for await (const event of orchestrateDialogue(
      {
        streamText: async function* () {
          yield '第一段。'
          yield '第二段。'
        },
        generateOptions: async () => [
          {
            semantic: 'align',
            label: '我愿意继续听下去'
          },
          {
            semantic: 'challenge',
            label: '你先告诉我为什么是昆仑'
          }
        ]
      },
      {
        currentNode: mainlineStoryOutline.nodes[0],
        retrievedEntries: [
          {
            id: 'myth-origin-01',
            topic: 'myth-origin',
            source: 'docs/knowledge-base/cultural-knowledge.md#昆仑山的神圣地位',
            summary: '昆仑被视为世界中心。',
            extension: '西王母形象见证昆仑文化的长期演化。',
            storyNodeIds: ['kunlun-threshold'],
            keywords: ['昆仑', '西王母']
          }
        ],
        runtimeState: createDefaultRuntimeState(mainlineStoryOutline),
        attitudeChoiceMode: 'challenge',
        recentTurns: []
      }
    )) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['chunk', 'chunk', 'options', 'complete'])
    expect(events[2]).toMatchObject({
      type: 'options',
      options: [
        { semantic: 'align' },
        { semantic: 'challenge' }
      ]
    })
  })
})