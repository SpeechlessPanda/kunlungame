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
      recentTurnFingerprints: ['开场："对嘛，你来了！咱俩找个安静…"'],
      avoidOpeners: ['呀，诶呀！'],
      forbiddenProperNouns: ['盘古', '女娲']
    })

    expect(result).toContain('# 固定规则')
    expect(result.indexOf('# 固定规则')).toBeLessThan(result.indexOf('# 当前节点'))
    expect(result.indexOf('# 当前节点')).toBeLessThan(result.indexOf('# 可用的知识条目'))
    expect(result.indexOf('# 可用的知识条目')).toBeLessThan(result.indexOf('# 历史摘要'))
    expect(result.indexOf('# 历史摘要')).toBeLessThan(result.indexOf('# 本轮剧情边界'))
    expect(result.indexOf('# 本轮剧情边界')).toBeLessThan(result.indexOf('# 本轮必须避免的开头'))
    expect(result.indexOf('# 本轮必须避免的开头')).toBeLessThan(result.indexOf('# 现在开始说话'))

    // 不得把完整上一轮原文以 [[PREV_REPLY_n]] 块的形式透给模型（是可以在禁止清单里提名的）。
    expect(result).not.toMatch(/\[\[PREV_REPLY_\d+\]\]/)
    expect(result).not.toContain('历史轮 1:')
    expect(result).not.toMatch(/\n---\n/)

    // 指纹/禁句/禁用名词被显式注入。
    expect(result).toContain('对嘛，你来了！')
    expect(result).toContain('呀，诶呀！')
    expect(result).toContain('盘古、女娲')

    // 护栏文本出现在最后。
    expect(result).toContain('现在开始说话')
  })

  it('falls back to placeholder when there are no fingerprints or forbidden nouns', () => {
    const result = buildLayeredContext({
      systemRules: [],
      currentNode: { title: '首轮', summary: '序章' },
      retrievedKnowledge: [],
      memorySummary: '暂无摘要'
    })

    expect(result).toContain('本轮没有额外禁句')
    expect(result).toContain('（本节点没有额外需要避开的后续专有名词。）')
  })
})