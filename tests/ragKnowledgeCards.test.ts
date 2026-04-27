import { describe, expect, it } from 'vitest'
import type { KnowledgeEntry } from '../src/shared/contracts/contentContracts.js'
import { formatKnowledgeEntriesForPrompt } from '../src/modeling/ragKnowledgeCards.js'

const entries: KnowledgeEntry[] = [
  {
    id: 'myth-origin-01',
    topic: 'myth-origin',
    source: 'docs/knowledge-base/cultural-knowledge.md#昆仑山的神圣地位',
    summary: '世界中心与天柱',
    extension: '- 昆仑山在古代神话中被视为世界中心\n- 《山海经》称昆仑为帝之下都\n- 三层结构对应天、地、人三界',
    storyNodeIds: ['kunlun-threshold'],
    keywords: ['昆仑', '山海经']
  },
  {
    id: 'myth-origin-02',
    topic: 'myth-origin',
    source: 'docs/knowledge-base/cultural-knowledge.md#西王母的形象演变',
    summary: '西王母的形象演变',
    extension: '**早期形象**：《山海经》中的西王母豹尾虎齿\n**道教升华**：成为女仙之首',
    storyNodeIds: ['kunlun-threshold'],
    keywords: ['西王母']
  }
]

describe('formatKnowledgeEntriesForPrompt', () => {
  it('turns retrieved entries into source-grounded RAG cards instead of raw markdown notes', () => {
    const cards = formatKnowledgeEntriesForPrompt(entries).join('\n\n')

    expect(cards).toContain('RAG-K1 · 世界中心与天柱')
    expect(cards).toContain('来源：docs/knowledge-base/cultural-knowledge.md#昆仑山的神圣地位')
    expect(cards).toContain('事实要点：')
    expect(cards).toContain('昆仑山在古代神话中被视为世界中心')
    expect(cards).toContain('讲述方式：用昆仑小妹妹的口吻重新组织')
    expect(cards).not.toContain('**早期形象**')
    expect(cards).not.toMatch(/^-/m)
  })
})