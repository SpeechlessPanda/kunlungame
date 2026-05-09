export interface DesktopStartupSnapshot {
  appName: 'Kunlungame'
  shellReady: boolean
}

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
    openAiCompatible: {
      apiKey: string
      baseUrl: string
      model: string
      fallbackModels: string[]
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
    currentNodeId: string
    chunks: string[]
    combinedText: string
    options: Array<{ semantic: 'align' | 'challenge'; label: string }>
    completed: boolean
  }
  | {
    ok: false
    reason: 'node-missing' | 'api-missing' | 'orchestration-failed'
    message: string
  }

export type DesktopMainlineTurnStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'reset' }
  | { type: 'result'; result: DesktopMainlineTurnResult }
  | { type: 'error'; message: string }

export interface DesktopOpenAiCompatibleTestRequest {
  apiKey: string
  baseUrl: string
  model: string
}

export type DesktopOpenAiCompatibleTestResult =
  | { ok: true; model: string; latencyMs: number }
  | {
    ok: false
    reason:
    | 'missing-input'
    | 'invalid-base-url'
    | 'auth'
    | 'model-not-found'
    | 'http-error'
    | 'timeout'
    | 'network'
    status?: number
    message: string
  }

export interface DesktopBridge {
  ping(): Promise<string>
  getStartupSnapshot(): Promise<DesktopStartupSnapshot>
  runMainlineTurn(request: DesktopMainlineTurnRequest): Promise<DesktopMainlineTurnResult>
  streamMainlineTurn?(request: DesktopMainlineTurnRequest, onEvent: (event: DesktopMainlineTurnStreamEvent) => void): Promise<void>
  loadRuntimeState(): Promise<DesktopRuntimeStateSnapshot>
  saveRuntimeState(state: DesktopSerializedRuntimeState): Promise<void>
  /** OpenAI-compatible "测试连接"：用 max_tokens=1 打一次 /chat/completions。 */
  testOpenAiCompatibleConnection(request: DesktopOpenAiCompatibleTestRequest): Promise<DesktopOpenAiCompatibleTestResult>
  /** Quit the desktop shell entirely (used by the ending overlay's "退出游戏"). */
  quitApp(): Promise<void>
}

export interface DesktopRuntimeStateSnapshot {
  state: DesktopSerializedRuntimeState
  recoveryAction: 'created-default' | 'loaded-existing' | 'reset-corrupted'
}
