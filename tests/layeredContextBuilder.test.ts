import { describe, expect, it } from 'vitest'
import { buildLayeredContext } from '../src/modeling/layeredContextBuilder.js'

describe('buildLayeredContext', () => {
  it('builds the layered prompt context in the intended order', () => {
    const result = buildLayeredContext({
      systemRules: ['规则A', '规则B'],
      currentNode: {
        title: '开场',
        summary: '介绍昆仑与源头'
      },
      retrievedKnowledge: ['昆仑常被视作神山意象', '与文明源头想象有关'],
      memorySummary: '玩家上轮偏向顺从，已经听过昆仑的基础介绍。',
      recentTurns: ['AI: 昆仑并不只是山名。', '玩家: 继续说。']
    })

    expect(result).toContain('固定规则')
    expect(result.indexOf('固定规则')).toBeLessThan(result.indexOf('当前节点'))
    expect(result.indexOf('当前节点')).toBeLessThan(result.indexOf('检索知识'))
    expect(result.indexOf('检索知识')).toBeLessThan(result.indexOf('历史摘要'))
    expect(result.indexOf('历史摘要')).toBeLessThan(result.indexOf('你（昆仑）刚才说过的内容'))
    expect(result).toContain('仅用于避免重复')
    expect(result).toContain('历史轮 1: AI: 昆仑并不只是山名。')
  })
})