export type DesktopShellAction = 'launch-ready' | 'auto-download-required' | 'settings-download-required'

export interface DesktopStartupSnapshot {
  appName: 'Kunlungame'
  shellReady: boolean
  modelSetup: {
    selectedProfileId: string
    shellAction: DesktopShellAction
  }
}

export interface DesktopDialogueSmokeResult {
  selectedProfileId: string
  currentNodeId: string
  fallbackUsed: boolean
  chunkCount: number
  combinedText: string
  options: Array<{
    semantic: 'align' | 'challenge'
    label: string
  }>
  completed: boolean
}

/**
 * 序列化格式的 Part 04 RuntimeState——主进程和渲染进程之间通过 IPC 传递时使用。
 * 和 `src/runtime/runtimeState.ts#RuntimeState` 字段保持一致，但避免 renderer 侧反向依赖。
 */
export interface DesktopSerializedRuntimeState {
  saveVersion: number
  currentNodeId: string
  turnIndex: number
  attitudeScore: number
  historySummary: string
  readNodeIds: string[]
  settings: {
    bgmEnabled: boolean
  }
}

export interface DesktopMainlineTurnRequest {
  nodeId: string
  attitudeChoiceMode: 'align' | 'challenge'
  runtimeState: DesktopSerializedRuntimeState
  recentTurns: string[]
}

export type DesktopMainlineTurnResult =
  | {
    ok: true
    selectedProfileId: string
    modelPath: string
    currentNodeId: string
    fallbackUsed: boolean
    chunks: string[]
    combinedText: string
    options: Array<{ semantic: 'align' | 'challenge'; label: string }>
    completed: boolean
  }
  | {
    ok: false
    reason: 'node-missing' | 'model-missing' | 'model-load-failed' | 'orchestration-failed'
    message: string
    modelPath?: string
  }

export interface DesktopBridge {
  ping(): Promise<string>
  getStartupSnapshot(): Promise<DesktopStartupSnapshot>
  runDialogueSmoke(): Promise<DesktopDialogueSmokeResult>
  runMainlineTurn(request: DesktopMainlineTurnRequest): Promise<DesktopMainlineTurnResult>
  loadRuntimeState(): Promise<DesktopRuntimeStateSnapshot>
  saveRuntimeState(state: DesktopSerializedRuntimeState): Promise<void>
}

export interface DesktopRuntimeStateSnapshot {
  state: DesktopSerializedRuntimeState
  recoveryAction: 'created-default' | 'loaded-existing' | 'reset-corrupted'
}