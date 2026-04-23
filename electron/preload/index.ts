import type { DesktopBridge, DesktopDialogueSmokeResult, DesktopStartupSnapshot } from '../../src/shared/types/desktop.js'

export interface IpcRendererLike {
  invoke(channel: string): Promise<unknown>
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