import type {
  DesktopBridge,
  DesktopDialogueSmokeResult,
  DesktopDownloadProfileResult,
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnResult,
  DesktopMainlineTurnStreamEvent,
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

const createRequestId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const streamIpcEvents = <T>(input: {
  renderer: IpcRendererLike
  channel: string
  onEvent: (event: T) => void
  start: () => Promise<unknown>
  isTerminal: (event: T) => boolean
}): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const cleanup = (): void => {
      input.renderer.removeListener?.(input.channel, listener as (event: unknown, ...args: unknown[]) => void)
    }

    const settle = (callback: () => void): void => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }

    const listener = (_event: unknown, payload: unknown): void => {
      const next = payload as T
      try {
        input.onEvent(next)
      } catch (error) {
        settle(() => reject(error))
        return
      }
      if (input.isTerminal(next)) settle(resolve)
    }

    if (input.renderer.on == null || input.renderer.removeListener == null) {
      reject(new Error('ipcRenderer event subscription is unavailable'))
      return
    }

    input.renderer.on(input.channel, listener as (event: unknown, ...args: unknown[]) => void)
    void input.start().catch((error: unknown) => {
      const streamError = { type: 'error', message: error instanceof Error ? error.message : String(error) } as T
      try {
        input.onEvent(streamError)
      } catch (callbackError) {
        settle(() => reject(callbackError))
        return
      }
      settle(() => reject(error))
    })
  })
}

export const createDesktopBridge = (renderer: IpcRendererLike): DesktopBridge => ({
  async quitApp(): Promise<void> {
    await renderer.invoke('desktop:quit-app')
  },
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
  async streamMainlineTurn(
    request: DesktopMainlineTurnRequest,
    onEvent: (event: DesktopMainlineTurnStreamEvent) => void
  ): Promise<void> {
    const requestId = createRequestId()
    const channel = `desktop:mainline-turn-stream:${requestId}`
    await streamIpcEvents<DesktopMainlineTurnStreamEvent>({
      renderer,
      channel,
      onEvent,
      start: async () => await renderer.invoke('desktop:stream-mainline-turn', requestId, request),
      isTerminal: (event) => event.type === 'result' || event.type === 'error'
    })
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

/**
 * Synchronously expose the desktop bridge to the renderer.
 *
 * Earlier this was done via `await import('electron')`, which created a race:
 * the renderer's `onMounted` could detect `kunlunDesktop` as `undefined` and
 * permanently fall back to mock dependencies, so `pnpm dev` would never run
 * the real local model. Loading `electron` synchronously via `require` (the
 * preload bundle is CommonJS) guarantees the bridge exists before the page
 * script evaluates.
 */
const registerDesktopBridge = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronModule = require('electron') as {
    contextBridge: { exposeInMainWorld: (key: string, value: unknown) => void }
    ipcRenderer: IpcRendererLike
  }
  const desktopBridge = createDesktopBridge(electronModule.ipcRenderer)
  electronModule.contextBridge.exposeInMainWorld('kunlunDesktop', desktopBridge)
}

if (process.env['VITEST'] !== 'true') {
  registerDesktopBridge()
}