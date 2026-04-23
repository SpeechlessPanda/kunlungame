export type DesktopShellAction = 'launch-ready' | 'auto-download-required' | 'settings-download-required'

export interface DesktopStartupSnapshot {
  appName: 'Kunlungame'
  shellReady: boolean
  modelSetup: {
    selectedProfileId: string
    shellAction: DesktopShellAction
  }
}

export interface DesktopBridge {
  ping(): Promise<string>
  getStartupSnapshot(): Promise<DesktopStartupSnapshot>
}