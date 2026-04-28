import { describe, expect, it } from 'vitest'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import { buildStoryPrompt, collectForbiddenProperNouns } from '../src/modeling/storyPromptBuilder.js'

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

    expect(prompt.system).toContain('必须使用中文')
    expect(prompt.system).toContain('昆仑子')
    expect(prompt.system).not.toContain('小妹妹')
    expect(prompt.system).toContain('称呼玩家为"你"')
    expect(prompt.system).toContain('不得用"你们"称呼玩家')
    expect(prompt.system).toContain('[[PREV_REPLY')
    expect(prompt.system).toContain('System:')
    expect(prompt.user).toContain(currentNode.coreQuestion)
    expect(prompt.user).toContain(currentNode.mustIncludeFacts[0] ?? '')
    expect(prompt.user).toContain('昆仑被视为世界中心。')
    expect(prompt.user).toContain('顺着你继续听下去')
    expect(prompt.user).toContain('禁止提前涉及')
    expect(prompt.system).toContain('禁止提前涉及的专有名词')
    expect(`${prompt.system}\n${prompt.user}`).not.toContain('你们已经')
  })

  it("reflects challenge tone and later-turn familiarity in the user prompt", () => {
    const currentNode = mainlineStoryOutline.nodes[3]
    const defaultState = createDefaultRuntimeState(mainlineStoryOutline)
    const runtimeState = {
      ...defaultState,
      turnIndex: 4,
      attitudeScore: -2
    }

    const prompt = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState,
      attitudeChoiceMode: 'challenge',
      recentTurns: []
    })

    expect(prompt.user).toContain('怀疑或反驳')
    expect(prompt.user).toContain('主动调侃、打趣')
    expect(prompt.user).toContain('具体的时间、地名、典籍')
  })

  it('injects turn fingerprints and forbidden proper nouns derived from later nodes', () => {
    // kunlun-threshold 节点，recentTurns 里塞一条"呀，诶呀"开场，
    // storyPromptBuilder 应该从开场/收尾里抽取指纹作为禁句，
    // 同时从后续节点（如 creation-myths）抽出"盘古/女娲/大禹"之类禁用词。
    const currentNode = mainlineStoryOutline.nodes[0]
    const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
    const prompt = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState: { ...runtimeState, turnIndex: 1, turnsInCurrentNode: 1 },
      attitudeChoiceMode: 'align',
      recentTurns: [
        '呀，诶呀！你今天来得真巧。我先简单讲讲昆仑。西王母是一位神奇的女仙。你觉得神话是不是很有趣？'
      ]
    })

    expect(prompt.user).toContain('禁句 1：')
    expect(prompt.user).toContain('开场：')
    expect(prompt.user).toContain('呀，诶呀！')
    // 不得把完整上一轮原文以 PREV_REPLY 块的形式透给模型
    expect(prompt.user).not.toMatch(/\[\[PREV_REPLY_\d+\]\]/)
    // 后续节点 creation-myths 的关键词之一
    expect(prompt.user).toMatch(/盘古|女娲|大禹/)
  })

  it('reacts to attitudeScore with a score-specific tone clause', () => {
    const currentNode = mainlineStoryOutline.nodes[0]
    const baseState = createDefaultRuntimeState(mainlineStoryOutline)

    const warm = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState: { ...baseState, attitudeScore: 3 },
      attitudeChoiceMode: 'align',
      recentTurns: []
    })
    expect(warm.user).toContain('非常熟')

    const cool = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState: { ...baseState, attitudeScore: -3 },
      attitudeChoiceMode: 'challenge',
      recentTurns: []
    })
    expect(cool.user).toContain('非常警惕')
    expect(cool.user).toContain('硬证据')
  })

  it('tightens length and paragraph requirements in strict coverage mode', () => {
    const currentNode = mainlineStoryOutline.nodes[0]
    const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
    const prompt = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState,
      attitudeChoiceMode: 'align',
      recentTurns: [],
      strictCoverage: true
    })

    expect(prompt.system).toContain('必须输出 4 个自然段')
    expect(prompt.system).toContain('少于 180 个汉字')
    expect(prompt.system).toContain('前 180 个汉字里不得使用问号')
    expect(prompt.system).toContain('只给泛泛感叹，都算失败')
  })

  it('injects compressed prior model replies as continuity context without internal labels', () => {
    const currentNode = mainlineStoryOutline.nodes[1]
    const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
    const prompt = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState: { ...runtimeState, turnIndex: 2, turnsInCurrentNode: 1 },
      attitudeChoiceMode: 'align',
      recentTurns: [
        '昆仑子刚才说，昆仑把神话、地理和身份三条线接在一起，所以回望文化时先从这座山开始。你当时追问这是不是过度象征。',
        '她接着补充，《山海经》里的天帝都城不是地图事实，而是一种古人理解天地秩序的方式。'
      ]
    })

    expect(prompt.user).toContain('# 上文连续性')
    expect(prompt.user).toContain('昆仑把神话、地理和身份三条线接在一起')
    expect(prompt.user).toContain('古人理解天地秩序')
    expect(prompt.user).not.toContain('[[PREV_REPLY')
  })

  it('derives anti-spoiler terms from future node fact text without banning the current node', () => {
    const currentNode = mainlineStoryOutline.nodes.find((node) => node.id === 'fusion-and-refinement')!
    const forbidden = collectForbiddenProperNouns(currentNode)

    expect(forbidden).toContain('营造学社')
    expect(forbidden).toContain('新文化运动')
    expect(forbidden).toContain('文化自觉')
    expect(forbidden).toContain('非物质文化遗产')
    expect(forbidden).not.toContain('苏轼')
    expect(forbidden).not.toContain('青花')
  })

  it('keeps middle-node prompts focused on current facts while naming later spoiler boundaries', () => {
    const currentNode = mainlineStoryOutline.nodes.find((node) => node.id === 'fusion-and-refinement')!
    const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
    const prompt = buildStoryPrompt({
      currentNode,
      retrievedEntries: [],
      runtimeState: {
        ...runtimeState,
        currentNodeId: currentNode.id,
        turnIndex: 5,
        turnsInCurrentNode: 0,
        readNodeIds: ['kunlun-threshold', 'creation-myths', 'civilization-roots', 'order-and-thought', 'empire-and-openness']
      },
      attitudeChoiceMode: 'align',
      recentTurns: []
    })

    expect(prompt.user).toContain('宋代词学')
    expect(prompt.system).toContain('营造学社')
    expect(prompt.system).toContain('新文化运动')
    expect(prompt.system).toContain('文化自觉')
    expect(prompt.system).not.toContain('禁止提前涉及的专有名词 / 事件 / 人物：苏轼')
  })
})