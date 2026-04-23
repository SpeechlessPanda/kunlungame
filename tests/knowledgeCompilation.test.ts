import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  compileKnowledgeDirectory,
  parseKnowledgeMarkdown,
  retrieveKnowledgeEntries
} from '../src/modeling/knowledgeCompilation.js'

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

    expect(result.entries.map((entry) => entry.id)).toEqual(['direct-node-match', 'keyword-only'])
    expect(result.fallbackUsed).toBe(false)
  })

  it('returns a fallback result instead of throwing when no entries match', () => {
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
      theme: '商业文化',
      keywords: ['交子'],
      limit: 1
    })

    expect(result.fallbackUsed).toBe(true)
    expect(result.entries[0]?.id).toBe('general-entry')
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
})