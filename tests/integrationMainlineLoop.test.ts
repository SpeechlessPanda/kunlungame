import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { retrieveKnowledgeEntries } from '../src/modeling/knowledgeCompilation.js'
import {
  orchestrateDialogue,
  type DialogueDependencies,
  type DialogueEvent
} from '../src/modeling/dialogueOrchestrator.js'
import {
  applyPlayerChoice,
  createDefaultRuntimeState,
  type RuntimeState
} from '../src/runtime/runtimeState.js'
import {
  loadRuntimeState,
  saveRuntimeState
} from '../src/runtime/saveRepository.js'
import {
  knowledgeEntrySchema,
  type KnowledgeEntry
} from '../src/shared/contracts/contentContracts.js'

/**
 * Part 08 · 端到端集成测试
 *
 * 串联 Part 02（主线 + 知识契约）、Part 03（知识编译 / 检索）、
 * Part 04（运行时状态 + 存档仓储）、Part 05（提示词 + 对话编排）
 * 的非 UI 管线，验证：
 *   1) 可从 canonical `mainlineStoryOutline` 入口进入主线；
 *   2) 每轮都能按节点约束检索到知识片段；
 *   3) 对话事件流顺序稳定（chunk → options → complete）；
 *   4) 玩家选择后主线按 `nextNodeId` 单向推进，态度值在 [-3, 3] 钳制；
 *   5) 文化记忆摘要由 `readNodeIds` 重建；
 *   6) 存档写入后可被重新读取并恢复到同一节点。
 *
 * 对上层 UI、本地模型文件无依赖：`DialogueDependencies` 由测试注入一个
 * deterministic mock，模拟 `streamText` 与 `generateOptions`。
 */

const loadCompiledKnowledgeEntries = async (): Promise<KnowledgeEntry[]> => {
  const knowledgeEntriesFile = join(
    process.cwd(),
    'src',
    'content',
    'generated',
    'knowledgeEntries.json'
  )
  const raw = await readFile(knowledgeEntriesFile, 'utf8')
  return knowledgeEntrySchema.array().parse(JSON.parse(raw))
}

const createMockDialogueDependencies = (): DialogueDependencies => ({
  async *streamText(prompt) {
    // 校验提示词里真的出现了当前节点的必经事实，否则直接让测试失败。
    if (!prompt.user.includes('必须包含的事实')) {
      throw new Error('Prompt missing mustIncludeFacts anchor.')
    }
    yield '开篇一句，'
    yield '再接一句说明本轮主题。'
  },
  async generateOptions({ semantics }) {
    return semantics.map((semantic) => ({
      semantic,
      label:
        semantic === 'align'
          ? '愿意沿着这条线继续听下去。'
          : '我更想先解开其中的矛盾。'
    }))
  }
})

const collectDialogueEvents = async (
  deps: DialogueDependencies,
  node: typeof mainlineStoryOutline.nodes[number],
  retrievedEntries: KnowledgeEntry[],
  runtimeState: RuntimeState
): Promise<DialogueEvent[]> => {
  const events: DialogueEvent[] = []
  for await (const event of orchestrateDialogue(deps, {
    currentNode: node,
    retrievedEntries,
    runtimeState,
    attitudeChoiceMode: 'align',
    recentTurns: []
  })) {
    events.push(event)
  }
  return events
}

describe('Part 08 · mainline integration loop', () => {
  it('drives the first three canonical nodes end-to-end and persists progress', async () => {
    const entries = await loadCompiledKnowledgeEntries()
    expect(entries.length).toBeGreaterThan(0)

    let runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
    expect(runtimeState.currentNodeId).toBe(mainlineStoryOutline.entryNodeId)
    expect(runtimeState.attitudeScore).toBe(0)
    expect(runtimeState.readNodeIds).toEqual([])

    const deps = createMockDialogueDependencies()

    const expectedNodeIds = [
      'kunlun-threshold',
      'creation-myths',
      'civilization-roots'
    ]

    for (const expectedId of expectedNodeIds) {
      const node = mainlineStoryOutline.nodes.find((n) => n.id === runtimeState.currentNodeId)
      if (!node) {
        throw new Error(`Current node '${runtimeState.currentNodeId}' missing from outline.`)
      }
      expect(node.id).toBe(expectedId)

      // Part 03 · 检索在节点约束下返回候选。
      const retrieval = retrieveKnowledgeEntries({
        entries,
        currentNodeId: node.id,
        allowedTopics: node.allowedKnowledgeTopics,
        theme: node.theme,
        keywords: node.retrievalKeywords,
        limit: 3
      })
      expect(retrieval.entries.length).toBeGreaterThan(0)
      for (const entry of retrieval.entries) {
        // 不得越过当前节点的允许主题。
        expect(node.allowedKnowledgeTopics).toContain(entry.topic)
      }

      // Part 05 · 编排事件流顺序稳定。
      const events = await collectDialogueEvents(deps, node, retrieval.entries, runtimeState)
      const types = events.map((e) => e.type)
      expect(types[0]).toBe('chunk')
      expect(types).toContain('options')
      expect(types[types.length - 1]).toBe('complete')
      const optionsEvent = events.find((e) => e.type === 'options')
      expect(optionsEvent).toBeDefined()
      if (optionsEvent && optionsEvent.type === 'options') {
        const semantics = optionsEvent.options.map((o) => o.semantic).sort()
        expect(semantics).toEqual(['align', 'challenge'])
      }

      // Part 04 · 应用玩家选择，推进主线并更新态度值与已读节点。
      // 2026-04 扩展版：每个节点需要 minTurns 轮对话才会真正推进。
      const before = runtimeState
      for (let i = 0; i < node.minTurns; i += 1) {
        runtimeState = applyPlayerChoice({
          state: runtimeState,
          storyOutline: mainlineStoryOutline,
          choice: 'align'
        })
      }
      expect(runtimeState.turnIndex).toBe(before.turnIndex + node.minTurns)
      expect(runtimeState.readNodeIds).toContain(node.id)
      expect(runtimeState.attitudeScore).toBeGreaterThanOrEqual(-3)
      expect(runtimeState.attitudeScore).toBeLessThanOrEqual(3)
      // 摘要由 readNodeIds 重建。
      expect(runtimeState.historySummary).toContain(node.title)
      // 推进到 nextNodeId。
      expect(runtimeState.currentNodeId).toBe(node.nextNodeId)
    }

    // 三轮后应该处于 'order-and-thought'。
    expect(runtimeState.currentNodeId).toBe('order-and-thought')
    expect(runtimeState.readNodeIds).toEqual(expectedNodeIds)
    expect(runtimeState.attitudeScore).toBe(3) // 三次 align，饱和至上界。

    // Part 04 · 存档 → 加载，确保中断后可恢复到同一节点。
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlun-int-'))
    try {
      const saveFilePath = join(tempDir, 'save.json')
      await saveRuntimeState({ saveFilePath, state: runtimeState })
      const loaded = await loadRuntimeState({
        storyOutline: mainlineStoryOutline,
        saveFilePath
      })
      expect(loaded.recoveryAction).toBe('loaded-existing')
      expect(loaded.state.currentNodeId).toBe(runtimeState.currentNodeId)
      expect(loaded.state.attitudeScore).toBe(runtimeState.attitudeScore)
      expect(loaded.state.readNodeIds).toEqual(runtimeState.readNodeIds)
      expect(loaded.state.historySummary).toBe(runtimeState.historySummary)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('rebuilds cultural-memory summary from readNodeIds on reload', async () => {
    // 2026-04 扩展版：kunlun-threshold 需要 minTurns 轮才会推进，readNodeIds 只在翻页时追加。
    const thresholdMinTurns =
      mainlineStoryOutline.nodes.find((n) => n.id === 'kunlun-threshold')?.minTurns ?? 1
    let stateAfterOneTurn = createDefaultRuntimeState(mainlineStoryOutline)
    for (let i = 0; i < thresholdMinTurns; i += 1) {
      stateAfterOneTurn = applyPlayerChoice({
        state: stateAfterOneTurn,
        storyOutline: mainlineStoryOutline,
        choice: 'challenge'
      })
    }
    expect(stateAfterOneTurn.readNodeIds).toEqual(['kunlun-threshold'])
    expect(stateAfterOneTurn.historySummary).toContain('昆仑初问')

    const tempDir = await mkdtemp(join(tmpdir(), 'kunlun-int-mem-'))
    try {
      const saveFilePath = join(tempDir, 'save.json')
      // 故意写入被篡改过的 historySummary，验证加载时会按 outline 重建。
      const tampered: RuntimeState = {
        ...stateAfterOneTurn,
        historySummary: '伪造的摘要内容——不应被信任。'
      }
      await saveRuntimeState({ saveFilePath, state: tampered })
      const loaded = await loadRuntimeState({
        storyOutline: mainlineStoryOutline,
        saveFilePath
      })
      expect(loaded.state.historySummary).not.toBe(tampered.historySummary)
      expect(loaded.state.historySummary).toContain('昆仑初问')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('retrieval falls back under node boundary when no keyword hits', async () => {
    const entries = await loadCompiledKnowledgeEntries()
    const node = mainlineStoryOutline.nodes.find((n) => n.id === 'kunlun-threshold')!
    const retrieval = retrieveKnowledgeEntries({
      entries,
      currentNodeId: node.id,
      allowedTopics: node.allowedKnowledgeTopics,
      theme: node.theme,
      keywords: ['完全不匹配的关键词 ZZZQ'],
      limit: 2
    })
    // 即使降级也不能越过 allowedKnowledgeTopics。
    for (const entry of retrieval.entries) {
      expect(node.allowedKnowledgeTopics).toContain(entry.topic)
    }
  })
})
