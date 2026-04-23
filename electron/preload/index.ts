import type {
  DesktopBridge,
  DesktopDialogueSmokeResult,
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnResult,
  DesktopRuntimeStateSnapshot,
  DesktopSerializedRuntimeState,
  DesktopStartupSnapshot
} from '../../src/shared/types/desktop.js'

export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
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