import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  compileKnowledgeSources,
  compileKnowledgeDirectory,
  parseKnowledgeMarkdown,
  retrieveKnowledgeEntries
} from '../src/modeling/knowledgeCompilation.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'

const sampleMarkdown = `---
id: kunlun-myth-overview
topic: 昆仑神话
source: 山海经占位来源
storyNodeIds:
  - kunlun-prologue
keywords:
  - 昆仑
  - 西王母
---

## Summary

概述昆仑在古代文化想象中的地位。

## Extension

可延伸到西王母与周穆王的叙事。
`

const culturalKnowledgeMarkdown = `# 昆仑谣：文化知识库

## 一、昆仑神话与上古世界观

### 1.1 昆仑山的神圣地位

- 昆仑山被视为世界中心与天柱
- 西王母形象见证昆仑文化演化

### 1.2 核心神话故事

- 盘古开天、女娲补天与大禹治水构成神话源流

## 九、当代文化自觉与回归

### 9.1 文化自觉

- 费孝通提出文化自觉
- 数字文化让传统回到当代生活

## 十、叙事素材与对话设计

### 10.5 游戏对话示例

- 这一节只作为 prompt 示例，不能进入事实检索
`

describe('parseKnowledgeMarkdown', () => {
  it('parses constrained markdown into a structured knowledge entry', () => {
    const result = parseKnowledgeMarkdown(sampleMarkdown, 'md/knowledge/kunlun-myth-overview.md')

    expect(result.id).toBe('kunlun-myth-overview')
    expect(result.storyNodeIds).toEqual(['kunlun-prologue'])
    expect(result.summary).toContain('昆仑')
  })
})

describe('compileKnowledgeDirectory', () => {
  it('compiles markdown files into stable structured JSON output', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-knowledge-'))
    const inputDir = join(tempDir, 'knowledge')
    const outputFile = join(tempDir, 'compiled-knowledge.json')

    await mkdir(inputDir, { recursive: true })
    await writeFile(join(inputDir, 'kunlun-myth-overview.md'), sampleMarkdown, 'utf8')

    const result = await compileKnowledgeDirectory({
      inputDir,
      outputFile
    })

    const writtenFile = JSON.parse(await readFile(outputFile, 'utf8')) as Array<{ id: string }>

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.id).toBe('kunlun-myth-overview')
    expect(writtenFile[0]?.id).toBe('kunlun-myth-overview')
  })

  it('fails fast when the input directory contains no valid knowledge markdown files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-knowledge-empty-'))
    const inputDir = join(tempDir, 'knowledge')
    const outputFile = join(tempDir, 'compiled-knowledge.json')

    await mkdir(inputDir, { recursive: true })

    await expect(
      compileKnowledgeDirectory({
        inputDir,
        outputFile
      })
    ).rejects.toThrow("Knowledge compilation produced no entries")
  })
})

describe('compileKnowledgeSources', () => {
  it('compiles the cultural knowledge markdown into story outline and knowledge entry outputs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-cultural-knowledge-'))
    const knowledgeSourceFile = join(tempDir, 'cultural-knowledge.md')
    const outputDir = join(tempDir, 'generated')

    await writeFile(knowledgeSourceFile, culturalKnowledgeMarkdown, 'utf8')

    const result = await compileKnowledgeSources({
      knowledgeSourceFile,
      storyOutline: mainlineStoryOutline,
      outputDir
    })

    const writtenStoryOutline = JSON.parse(
      await readFile(join(outputDir, 'storyOutline.json'), 'utf8')
    ) as { entryNodeId: string }
    const writtenEntries = JSON.parse(
      await readFile(join(outputDir, 'knowledgeEntries.json'), 'utf8')
    ) as Array<{ topic: string; storyNodeIds: string[] }>

    expect(result.storyOutline.entryNodeId).toBe('kunlun-threshold')
    expect(writtenStoryOutline.entryNodeId).toBe('kunlun-threshold')
    expect(result.entries.some((entry) => entry.topic === 'myth-origin')).toBe(true)
    expect(result.entries.every((entry) => entry.storyNodeIds.length > 0)).toBe(true)
    expect(writtenEntries.some((entry) => entry.topic === 'myth-origin')).toBe(true)
    expect(writtenEntries.every((entry) => entry.topic !== 'dialogue-samples')).toBe(true)
  })
})

describe('retrieveKnowledgeEntries', () => {
  it('prioritizes explicit story node matches over keyword-only matches', () => {
    const result = retrieveKnowledgeEntries({
      entries: [
        {
          id: 'keyword-only',
          topic: '西王母',
          source: '占位来源',
          summary: '只被关键词命中的条目。',
          extension: '延伸内容',
          storyNodeIds: ['different-node'],
          keywords: ['西王母']
        },
        {
          id: 'direct-node-match',
          topic: '昆仑神话',
          source: '占位来源',
          summary: '直接命中当前节点的条目。',
          extension: '延伸内容',
          storyNodeIds: ['kunlun-prologue'],
          keywords: ['昆仑']
        }
      ],
      currentNodeId: 'kunlun-prologue',
      theme: '神话源流',
      keywords: ['西王母'],
      limit: 2
    })

    expect(result.entries.map((entry) => entry.id)).toEqual(['direct-node-match'])
    expect(result.fallbackUsed).toBe(false)
  })

  it('returns an empty fallback result instead of crossing into another node', () => {
    const result = retrieveKnowledgeEntries({
      entries: [
        {
          id: 'general-entry',
          topic: '昆仑神话',
          source: '占位来源',
          summary: '通用回退条目。',
          extension: '延伸内容',
          storyNodeIds: ['kunlun-prologue'],
          keywords: ['昆仑']
        }
      ],
      currentNodeId: 'later-node',
      allowedTopics: ['commercial-culture'],
      theme: '商业文化',
      keywords: ['交子'],
      limit: 1
    })

    expect(result.fallbackUsed).toBe(true)
    expect(result.entries).toEqual([])
  })

  it('does not return future-node knowledge when only current-node entries remain eligible', () => {
    const result = retrieveKnowledgeEntries({
      entries: [
        {
          id: 'current-node-entry',
          topic: 'myth-origin',
          source: '占位来源',
          summary: '当前节点允许的知识条目。',
          extension: '延伸内容',
          storyNodeIds: ['kunlun-threshold'],
          keywords: ['昆仑']
        },
        {
          id: 'future-node-entry',
          topic: 'contemporary-return',
          source: '占位来源',
          summary: '未来节点条目。',
          extension: '延伸内容',
          storyNodeIds: ['contemporary-return'],
          keywords: ['文化自觉']
        }
      ],
      currentNodeId: 'kunlun-threshold',
      allowedTopics: ['myth-origin'],
      keywords: ['不存在的关键词'],
      limit: 3
    })

    expect(result.fallbackUsed).toBe(false)
    expect(result.entries.map((entry) => entry.id)).toEqual(['current-node-entry'])
    expect(result.entries.every((entry) => entry.storyNodeIds.includes('kunlun-threshold'))).toBe(true)
  })

  it('respects the requested result limit after ranking', () => {
    const result = retrieveKnowledgeEntries({
      entries: [
        {
          id: 'entry-a',
          topic: '昆仑神话',
          source: '占位来源',
          summary: '条目 A。',
          extension: '延伸 A',
          storyNodeIds: ['kunlun-prologue'],
          keywords: ['昆仑']
        },
        {
          id: 'entry-b',
          topic: '西王母',
          source: '占位来源',
          summary: '条目 B。',
          extension: '延伸 B',
          storyNodeIds: ['kunlun-prologue'],
          keywords: ['西王母']
        }
      ],
      currentNodeId: 'kunlun-prologue',
      theme: '神话',
      keywords: ['昆仑', '西王母'],
      limit: 1
    })

    expect(result.entries).toHaveLength(1)
  })

  it('rotates the ranked entry window when turnSalt changes (avoid identical context across turns)', () => {
    const baseEntries = [
      { id: 'a', topic: '昆仑神话', source: 's', summary: 'A', extension: 'EA', storyNodeIds: ['kunlun-prologue'], keywords: ['昆仑'] },
      { id: 'b', topic: '昆仑神话', source: 's', summary: 'B', extension: 'EB', storyNodeIds: ['kunlun-prologue'], keywords: ['昆仑'] },
      { id: 'c', topic: '昆仑神话', source: 's', summary: 'C', extension: 'EC', storyNodeIds: ['kunlun-prologue'], keywords: ['昆仑'] },
      { id: 'd', topic: '昆仑神话', source: 's', summary: 'D', extension: 'ED', storyNodeIds: ['kunlun-prologue'], keywords: ['昆仑'] }
    ]
    const baseInput = {
      entries: baseEntries,
      currentNodeId: 'kunlun-prologue',
      theme: '神话',
      keywords: ['昆仑'],
      limit: 2
    }

    const turn0 = retrieveKnowledgeEntries({ ...baseInput, turnSalt: 0 })
    const turn1 = retrieveKnowledgeEntries({ ...baseInput, turnSalt: 1 })
    const turn2 = retrieveKnowledgeEntries({ ...baseInput, turnSalt: 2 })

    expect(turn0.entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(turn1.entries.map((e) => e.id)).toEqual(['b', 'c'])
    expect(turn2.entries.map((e) => e.id)).toEqual(['c', 'd'])

    // 仅有少量条目时仍应正确 wrap-around，不重复也不丢失稳定性
    const turnWrap = retrieveKnowledgeEntries({ ...baseInput, turnSalt: 4 })
    expect(turnWrap.entries.map((e) => e.id)).toEqual(['a', 'b'])
  })
})