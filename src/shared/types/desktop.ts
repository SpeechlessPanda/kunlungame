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
  combinedTextLength?: number
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
  turnsInCurrentNode: number
  attitudeScore: number
  historySummary: string
  readNodeIds: string[]
  isCompleted: boolean
  settings: {
    bgmEnabled: boolean
    preferredModelMode: 'default' | 'compatibility' | 'pro'
    modelProvider: 'openai-compatible' | 'local'
    openAiCompatible: {
      apiKey: string
      baseUrl: string
      model: string
    }
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

export type DesktopMainlineTurnStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'reset' }
  | { type: 'result'; result: DesktopMainlineTurnResult }
  | { type: 'error'; message: string }

export interface DesktopBridge {
  ping(): Promise<string>
  getStartupSnapshot(): Promise<DesktopStartupSnapshot>
  runDialogueSmoke(): Promise<DesktopDialogueSmokeResult>
  runMainlineTurn(request: DesktopMainlineTurnRequest): Promise<DesktopMainlineTurnResult>
  streamMainlineTurn?(request: DesktopMainlineTurnRequest, onEvent: (event: DesktopMainlineTurnStreamEvent) => void): Promise<void>
  loadRuntimeState(): Promise<DesktopRuntimeStateSnapshot>
  saveRuntimeState(state: DesktopSerializedRuntimeState): Promise<void>
  getProfileAvailability(profileId: string): Promise<DesktopProfileAvailability>
  downloadProfile(profileId: string): Promise<DesktopDownloadProfileResult>
  onProfileDownloadProgress(handler: (event: DesktopProfileDownloadProgressEvent) => void): () => void
  /** Quit the desktop shell entirely (used by the ending overlay's "退出游戏"). */
  quitApp(): Promise<void>
}

export interface DesktopProfileAvailability {
  profileId: string
  status: 'ready' | 'partial' | 'missing'
  expectedFiles: string[]
  presentFiles: string[]
  missingFiles: string[]
  completionRatio: number
  manifestDownloadedAt: string | null
}

export interface DesktopProfileDownloadProgressEvent {
  profileId: string
  fileName: string | null
  phase: 'starting' | 'fetching-metadata' | 'downloading' | 'verifying' | 'file-done' | 'manifest-updated' | 'completed' | 'failed'
  fileIndex: number
  totalFiles: number
  message: string
  bytesDownloaded?: number
  totalBytes?: number
}

export type DesktopDownloadProfileResult =
  | { ok: true; profileId: string }
  | { ok: false; profileId: string; reason: 'unknown-profile' | 'download-failed' | 'already-running'; message: string }

export interface DesktopRuntimeStateSnapshot {
  state: DesktopSerializedRuntimeState
  recoveryAction: 'created-default' | 'loaded-existing' | 'reset-corrupted'
}