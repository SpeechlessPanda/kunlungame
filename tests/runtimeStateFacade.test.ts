import { describe, expect, it } from 'vitest'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import {
  createDefaultRuntimeState,
  SAVE_VERSION,
  type RuntimeState
} from '../src/runtime/runtimeState.js'
import {
  createDesktopRuntimeStateSnapshot,
  parseDesktopRuntimeState,
  serializeRuntimeStateForDesktop
} from '../src/runtime/runtimeStateFacade.js'
import type { DesktopSerializedRuntimeState } from '../src/shared/types/desktop.js'

describe('runtimeStateFacade', () => {
  it('serializes every desktop-visible runtime state field in one place', () => {
    const state: RuntimeState = {
      ...createDefaultRuntimeState(mainlineStoryOutline),
      currentNodeId: 'contemporary-return',
      turnIndex: 8,
      turnsInCurrentNode: 1,
      attitudeScore: -2,
      historySummary: '已修复的文化记忆片段：昆仑初问。',
      readNodeIds: ['kunlun-threshold'],
      isCompleted: true,
      settings: {
        bgmEnabled: false,
        preferredModelMode: 'pro'
      }
    }

    const serialized = serializeRuntimeStateForDesktop(state)

    expect(serialized).toEqual({
      saveVersion: SAVE_VERSION,
      currentNodeId: 'contemporary-return',
      turnIndex: 8,
      turnsInCurrentNode: 1,
      attitudeScore: -2,
      historySummary: '已修复的文化记忆片段：昆仑初问。',
      readNodeIds: ['kunlun-threshold'],
      isCompleted: true,
      settings: {
        bgmEnabled: false,
        preferredModelMode: 'pro'
      }
    })
  })

  it('parses old desktop payloads through the runtime schema defaults', () => {
    const legacyPayload = {
      saveVersion: SAVE_VERSION,
      currentNodeId: mainlineStoryOutline.entryNodeId,
      turnIndex: 0,
      attitudeScore: 0,
      historySummary: '尚未修复任何文化记忆片段。',
      readNodeIds: [],
      settings: {
        bgmEnabled: true,
        preferredModelMode: 'default'
      }
    } as unknown as DesktopSerializedRuntimeState

    const parsed = parseDesktopRuntimeState(legacyPayload)

    expect(parsed.turnsInCurrentNode).toBe(0)
    expect(parsed.isCompleted).toBe(false)
  })

  it('builds the desktop snapshot without dropping recovery metadata', () => {
    const state = createDefaultRuntimeState(mainlineStoryOutline)

    const snapshot = createDesktopRuntimeStateSnapshot(state, 'loaded-existing')

    expect(snapshot.recoveryAction).toBe('loaded-existing')
    expect(snapshot.state).toEqual(serializeRuntimeStateForDesktop(state))
  })
})