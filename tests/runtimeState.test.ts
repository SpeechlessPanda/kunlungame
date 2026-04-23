import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { minimalStoryOutline } from '../src/shared/contracts/contentContracts.js'
import {
  applyPlayerChoice,
  createDefaultRuntimeState,
  deserializeRuntimeState,
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
    expect(result.readNodeIds).toEqual([])
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

  it('persists and reloads a save file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-save-'))
    const saveFilePath = join(tempDir, 'save.json')
    const state = {
      ...createDefaultRuntimeState(minimalStoryOutline),
      attitudeScore: 2,
      turnIndex: 4,
      historySummary: '已进行四轮。'
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
    expect(reloaded.state).toEqual(state)
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