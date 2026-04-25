import { runtimeStateSchema, type RuntimeState } from './runtimeState.js'
import type {
  DesktopRuntimeStateSnapshot,
  DesktopSerializedRuntimeState
} from '../shared/types/desktop.js'

export const serializeRuntimeStateForDesktop = (state: RuntimeState): DesktopSerializedRuntimeState => ({
  saveVersion: state.saveVersion,
  currentNodeId: state.currentNodeId,
  turnIndex: state.turnIndex,
  turnsInCurrentNode: state.turnsInCurrentNode,
  attitudeScore: state.attitudeScore,
  historySummary: state.historySummary,
  readNodeIds: [...state.readNodeIds],
  isCompleted: state.isCompleted,
  settings: {
    bgmEnabled: state.settings.bgmEnabled,
    preferredModelMode: state.settings.preferredModelMode
  }
})

export const parseDesktopRuntimeState = (state: DesktopSerializedRuntimeState): RuntimeState => {
  return runtimeStateSchema.parse(state)
}

export const createDesktopRuntimeStateSnapshot = (
  state: RuntimeState,
  recoveryAction: DesktopRuntimeStateSnapshot['recoveryAction']
): DesktopRuntimeStateSnapshot => ({
  state: serializeRuntimeStateForDesktop(state),
  recoveryAction
})
