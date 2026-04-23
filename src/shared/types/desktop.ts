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

export interface DesktopBridge {
  ping(): Promise<string>
  getStartupSnapshot(): Promise<DesktopStartupSnapshot>
  runDialogueSmoke(): Promise<DesktopDialogueSmokeResult>
}