import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { minimalStoryOutline } from '../src/shared/contracts/contentContracts.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import {
  applyPlayerChoice,
  createDefaultRuntimeState,
  deserializeRuntimeState,
  resolveRuntimeStateAgainstStoryOutline,
  serializeRuntimeState,
  type PlayerAttitudeChoice
} from '../src/runtime/runtimeState.js'
import { loadRuntimeState, saveRuntimeState } from '../src/runtime/saveRepository.js'

describe('createDefaultRuntimeState', () => {
  it('creates a serializable default save from the story entry node', () => {
    const result = createDefaultRuntimeState(minimalStoryOutline)

    expect(result.currentNodeId).toBe('kunlun-prologue')
    expect(result.turnIndex).toBe(0)
    expect(result.attitudeScore).toBe(0)
    expect(result.settings.bgmEnabled).toBe(true)
    expect(result.settings.preferredModelMode).toBe('default')
    expect(result.readNodeIds).toEqual([])
  })

  it('starts from the structured mainline entry node and uses the repaired-memory summary wording', () => {
    const result = createDefaultRuntimeState(mainlineStoryOutline)

    expect(result.currentNodeId).toBe('kunlun-threshold')
    expect(result.historySummary).toBe('尚未修复任何文化记忆片段。')
  })
})

describe('applyPlayerChoice', () => {
  it('updates attitude, turn index, and keeps the mainline on terminal nodes', () => {
    const initialState = createDefaultRuntimeState(minimalStoryOutline)

    const result = applyPlayerChoice({
      state: initialState,
      storyOutline: minimalStoryOutline,
      choice: 'align'
    })

    expect(result.attitudeScore).toBe(1)
    expect(result.turnIndex).toBe(1)
    expect(result.currentNodeId).toBe('kunlun-prologue')
    expect(result.readNodeIds).toEqual(['kunlun-prologue'])
  })

  it('clamps attitude updates within the allowed range', () => {
    let state = createDefaultRuntimeState(minimalStoryOutline)

    for (let index = 0; index < 10; index += 1) {
      state = applyPlayerChoice({
        state,
        storyOutline: minimalStoryOutline,
        choice: 'align'
      })
    }

    expect(state.attitudeScore).toBe(3)
  })

  it('throws when the current node is missing from the story outline', () => {
    const initialState = {
      ...createDefaultRuntimeState(minimalStoryOutline),
      currentNodeId: 'missing-node'
    }

    expect(() =>
      applyPlayerChoice({
        state: initialState,
        storyOutline: minimalStoryOutline,
        choice: 'challenge'
      })
    ).toThrow("Current runtime node 'missing-node' is not present in the story outline.")
  })

  it('advances through the real mainline without changing the fixed node order', () => {
    // 2026-04 扩展版：节点允许多轮对话；kunlun-threshold.minTurns = 3，
    // 因此前两轮挑战只增加节点内轮次，第三轮才真正推进到 creation-myths。
    const thresholdMinTurns =
      mainlineStoryOutline.nodes.find((n) => n.id === 'kunlun-threshold')?.minTurns ?? 1

    let state = createDefaultRuntimeState(mainlineStoryOutline)
    for (let i = 0; i < thresholdMinTurns - 1; i += 1) {
      state = applyPlayerChoice({
        state,
        storyOutline: mainlineStoryOutline,
        choice: 'challenge'
      })
      expect(state.currentNodeId).toBe('kunlun-threshold')
      expect(state.readNodeIds).toEqual([])
    }

    const result = applyPlayerChoice({
      state,
      storyOutline: mainlineStoryOutline,
      choice: 'challenge'
    })

    expect(result.currentNodeId).toBe('creation-myths')
    expect(result.turnIndex).toBe(thresholdMinTurns)
    // 态度值在每轮 challenge 时 -1，并由 [-3, 3] 钳制；
    // 用 thresholdMinTurns 表达预期，避免 minTurns 后续再被调时反复改测试。
    const expectedAttitude = Math.max(-3, -thresholdMinTurns)
    expect(result.attitudeScore).toBe(expectedAttitude)
    expect(result.readNodeIds).toEqual(['kunlun-threshold'])
    expect(result.historySummary).toContain('昆仑初问')
    expect(result.historySummary).toContain('已修复')
  })

  it('marks the run as completed when the terminal node is resolved', () => {
    const baseState = createDefaultRuntimeState(mainlineStoryOutline)
    const atTerminal = {
      ...baseState,
      currentNodeId: 'contemporary-return',
      turnIndex: 7,
      readNodeIds: [
        'kunlun-threshold',
        'creation-myths',
        'civilization-roots',
        'order-and-thought',
        'empire-and-openness',
        'fusion-and-refinement',
        'rupture-and-guardianship'
      ]
    }

    expect(atTerminal.isCompleted).toBe(false)

    // 2026-04 扩展版：终节点也要满足 minTurns 才算完结，调用 minTurns 次 align 以推进到结局。
    const terminalMinTurns =
      mainlineStoryOutline.nodes.find((n) => n.id === 'contemporary-return')?.minTurns ?? 1
    let result = atTerminal as ReturnType<typeof applyPlayerChoice>
    for (let i = 0; i < terminalMinTurns; i += 1) {
      result = applyPlayerChoice({
        state: result,
        storyOutline: mainlineStoryOutline,
        choice: 'align'
      })
    }

    // 终章不再推进到下一个节点（没有下一个），但标记为已完结，供 UI 走"再走一次"分支。
    expect(result.currentNodeId).toBe('contemporary-return')
    expect(result.isCompleted).toBe(true)
    expect(result.turnIndex).toBe(7 + terminalMinTurns)
    expect(result.readNodeIds).toContain('contemporary-return')
  })

  it('preserves isCompleted=true once the ending has been reached', () => {
    const baseState = createDefaultRuntimeState(mainlineStoryOutline)
    const endedState = {
      ...baseState,
      currentNodeId: 'contemporary-return',
      turnIndex: 8,
      readNodeIds: ['contemporary-return'],
      isCompleted: true
    }

    const result = applyPlayerChoice({
      state: endedState,
      storyOutline: mainlineStoryOutline,
      choice: 'challenge'
    })

    expect(result.isCompleted).toBe(true)
    expect(result.currentNodeId).toBe('contemporary-return')
  })
})

describe('resolveRuntimeStateAgainstStoryOutline', () => {
  it('rebuilds the repaired-memory summary from saved read nodes', () => {
    const result = resolveRuntimeStateAgainstStoryOutline(
      {
        ...createDefaultRuntimeState(mainlineStoryOutline),
        currentNodeId: 'creation-myths',
        readNodeIds: ['kunlun-threshold', 'creation-myths'],
        historySummary: ''
      },
      mainlineStoryOutline
    )

    expect(result.historySummary).toContain('昆仑初问')
    expect(result.historySummary).toContain('神话开天')
  })
})

describe('runtime state serialization', () => {
  it('round-trips the runtime state payload without dropping fields', () => {
    const state = {
      ...createDefaultRuntimeState(minimalStoryOutline),
      historySummary: '玩家已经完成开场。',
      readNodeIds: ['kunlun-prologue']
    }

    const serialized = serializeRuntimeState(state)
    const restored = deserializeRuntimeState(serialized)

    expect(restored).toEqual(state)
  })
})

describe('saveRepository', () => {
  it('creates a default save when no save file exists yet', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-save-'))
    const saveFilePath = join(tempDir, 'save.json')

    const result = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath
    })

    expect(result.recoveryAction).toBe('created-default')
    expect(result.state.currentNodeId).toBe('kunlun-prologue')
  })

  it('creates the real mainline default save from kunlun-threshold', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-save-'))
    const saveFilePath = join(tempDir, 'save.json')

    const result = await loadRuntimeState({
      storyOutline: mainlineStoryOutline,
      saveFilePath
    })

    expect(result.recoveryAction).toBe('created-default')
    expect(result.state.currentNodeId).toBe('kunlun-threshold')
    expect(result.state.historySummary).toBe('尚未修复任何文化记忆片段。')
  })

  it('persists and reloads a save file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-save-'))
    const saveFilePath = join(tempDir, 'save.json')
    const state = {
      ...createDefaultRuntimeState(minimalStoryOutline),
      attitudeScore: 2,
      turnIndex: 4,
      historySummary: '占位摘要，会在重载时按已读节点重建。',
      readNodeIds: ['kunlun-prologue']
    }

    await saveRuntimeState({
      saveFilePath,
      state
    })

    const reloaded = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath
    })

    expect(reloaded.recoveryAction).toBe('loaded-existing')
    expect(reloaded.state).toEqual({
      ...state,
      historySummary: '已修复的文化记忆片段：昆仑开篇。'
    })
  })

  it('falls back to a new default save when the file is corrupted', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-save-'))
    const saveFilePath = join(tempDir, 'save.json')
    await writeFile(saveFilePath, '{broken json', 'utf8')

    const result = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath
    })

    const persisted = await readFile(saveFilePath, 'utf8')

    expect(result.recoveryAction).toBe('reset-corrupted')
    expect(result.state.currentNodeId).toBe('kunlun-prologue')
    expect(() => JSON.parse(persisted)).not.toThrow()
  })

  it('does not overwrite an existing save when the saved node no longer exists in the story outline', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-save-'))
    const saveFilePath = join(tempDir, 'save.json')
    await saveRuntimeState({
      saveFilePath,
      state: {
        ...createDefaultRuntimeState(minimalStoryOutline),
        currentNodeId: 'missing-node'
      }
    })

    await expect(
      loadRuntimeState({
        storyOutline: minimalStoryOutline,
        saveFilePath
      })
    ).rejects.toThrow("Current runtime node 'missing-node' is not present in the story outline.")

    const persisted = await readFile(saveFilePath, 'utf8')
    expect(persisted).toContain('missing-node')
  })
})