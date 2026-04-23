import { describe, expect, it } from 'vitest'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import { buildStoryPrompt } from '../src/modeling/storyPromptBuilder.js'

describe('buildStoryPrompt', () => {
  it('builds a Chinese prompt with node facts and anti-spoiler boundaries', () => {
    const currentNode = mainlineStoryOutline.nodes[0]
    const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)

    const prompt = buildStoryPrompt({
      currentNode,
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
      runtimeState,
      attitudeChoiceMode: 'align',
      recentTurns: ['玩家：我只记得昆仑这个名字。']
    })

    expect(prompt.system).toContain('始终使用中文回答')
    expect(prompt.system).toContain('不得剧透后续节点')
    expect(prompt.system).toContain('附和型')
    expect(prompt.system).toContain('反驳型')
    expect(prompt.user).toContain(currentNode.coreQuestion)
    expect(prompt.user).toContain(currentNode.mustIncludeFacts[0] ?? '')
    expect(prompt.user).toContain('昆仑被视为世界中心。')
    expect(prompt.user).toContain('玩家当前倾向：附和型')
    expect(prompt.user).toContain('禁止提前涉及')
  })
})