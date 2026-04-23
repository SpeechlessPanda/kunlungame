import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StoryOutline } from '../shared/contracts/contentContracts.js'
import {
  createDefaultRuntimeState,
  deserializeRuntimeState,
  resolveRuntimeStateAgainstStoryOutline,
  serializeRuntimeState,
  type RuntimeState
} from './runtimeState.js'

export type RuntimeStateRecoveryAction = 'created-default' | 'loaded-existing' | 'reset-corrupted'

export interface LoadRuntimeStateInput {
  storyOutline: StoryOutline
  saveFilePath: string
}

export interface LoadRuntimeStateResult {
  state: RuntimeState
  recoveryAction: RuntimeStateRecoveryAction
}

export interface SaveRuntimeStateInput {
  saveFilePath: string
  state: RuntimeState
}

const persistState = async (saveFilePath: string, state: RuntimeState): Promise<void> => {
  await mkdir(dirname(saveFilePath), { recursive: true })
  await writeFile(saveFilePath, serializeRuntimeState(state), 'utf8')
}

export const saveRuntimeState = async (input: SaveRuntimeStateInput): Promise<void> => {
  await persistState(input.saveFilePath, input.state)
}

export const loadRuntimeState = async (input: LoadRuntimeStateInput): Promise<LoadRuntimeStateResult> => {
  let savedPayload: string

  try {
    savedPayload = await readFile(input.saveFilePath, 'utf8')
  } catch (error: unknown) {
    const isMissingFile =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code: string }).code === 'ENOENT'

    if (!isMissingFile) {
      throw error
    }

    const defaultState = createDefaultRuntimeState(input.storyOutline)
    await persistState(input.saveFilePath, defaultState)

    return {
      state: defaultState,
      recoveryAction: 'created-default'
    }
  }

  let deserializedState: RuntimeState
  try {
    deserializedState = deserializeRuntimeState(savedPayload)
  } catch {
    const defaultState = createDefaultRuntimeState(input.storyOutline)
    await persistState(input.saveFilePath, defaultState)

    return {
      state: defaultState,
      recoveryAction: 'reset-corrupted'
    }
  }

  const state = resolveRuntimeStateAgainstStoryOutline(deserializedState, input.storyOutline)

  return {
    state,
    recoveryAction: 'loaded-existing'
  }
}