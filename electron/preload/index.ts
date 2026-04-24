import type {
  DesktopBridge,
  DesktopDialogueSmokeResult,
  DesktopDownloadProfileResult,
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnResult,
  DesktopProfileAvailability,
  DesktopProfileDownloadProgressEvent,
  DesktopRuntimeStateSnapshot,
  DesktopSerializedRuntimeState,
  DesktopStartupSnapshot
} from '../../src/shared/types/desktop.js'

export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on?(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
  removeListener?(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
}

export const createDesktopBridge = (renderer: IpcRendererLike): DesktopBridge => ({
  async ping(): Promise<string> {
    return await renderer.invoke('desktop:ping') as string
  },
  async getStartupSnapshot(): Promise<DesktopStartupSnapshot> {
    return await renderer.invoke('desktop:get-startup-snapshot') as DesktopStartupSnapshot
  },
  async runDialogueSmoke(): Promise<DesktopDialogueSmokeResult> {
    return await renderer.invoke('desktop:run-dialogue-smoke') as DesktopDialogueSmokeResult
  },
  async runMainlineTurn(request: DesktopMainlineTurnRequest): Promise<DesktopMainlineTurnResult> {
    return await renderer.invoke('desktop:run-mainline-turn', request) as DesktopMainlineTurnResult
  },
  async loadRuntimeState(): Promise<DesktopRuntimeStateSnapshot> {
    return await renderer.invoke('desktop:load-runtime-state') as DesktopRuntimeStateSnapshot
  },
  async saveRuntimeState(state: DesktopSerializedRuntimeState): Promise<void> {
    await renderer.invoke('desktop:save-runtime-state', state)
  },
  async getProfileAvailability(profileId: string): Promise<DesktopProfileAvailability> {
    return await renderer.invoke('desktop:get-profile-availability', profileId) as DesktopProfileAvailability
  },
  async downloadProfile(profileId: string): Promise<DesktopDownloadProfileResult> {
    return await renderer.invoke('desktop:download-profile', profileId) as DesktopDownloadProfileResult
  },
  onProfileDownloadProgress(handler: (event: DesktopProfileDownloadProgressEvent) => void): () => void {
    const listener = (_event: unknown, payload: unknown): void => {
      handler(payload as DesktopProfileDownloadProgressEvent)
    }
    renderer.on?.('desktop:profile-download-progress', listener as (event: unknown, ...args: unknown[]) => void)
    return () => {
      renderer.removeListener?.('desktop:profile-download-progress', listener as (event: unknown, ...args: unknown[]) => void)
    }
  }
})

const registerDesktopBridge = async (): Promise<void> => {
  const { contextBridge, ipcRenderer } = await import('electron')
  const desktopBridge = createDesktopBridge(ipcRenderer)
  contextBridge.exposeInMainWorld('kunlunDesktop', desktopBridge)
}

if (process.env['VITEST'] !== 'true') {
  void registerDesktopBridge()
}