import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import type {
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnResult,
  DesktopMainlineTurnStreamEvent,
  DesktopOpenAiCompatibleTestRequest,
  DesktopOpenAiCompatibleTestResult,
  DesktopRuntimeStateSnapshot,
  DesktopSerializedRuntimeState,
  DesktopStartupSnapshot
} from '../../src/shared/types/desktop.js'
import { testOpenAiCompatibleConnection } from '../../src/modeling/openAiCompatibleConnectionTest.js'
import { runMainlineTurn, type MainlineTurnStreamCallbacks } from '../../src/modeling/mainlineTurnRunner.js'
import {
  createDesktopRuntimeStateSnapshot,
  parseDesktopRuntimeState
} from '../../src/runtime/runtimeStateFacade.js'
import { loadRuntimeState, saveRuntimeState, type SecretCipher } from '../../src/runtime/saveRepository.js'
import { mainlineStoryOutline } from '../../src/content/source/mainlineOutline.js'

export const createSafeStorageSecretCipher = (
  safeStorage: { isEncryptionAvailable: () => boolean; encryptString: (plain: string) => Buffer; decryptString: (encrypted: Buffer) => string }
): SecretCipher => {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      encrypt: (plaintext) => plaintext,
      decrypt: (encoded) => encoded
    }
  }
  return {
    encrypt: (plaintext) => {
      if (plaintext.length === 0) return ''
      const buf = safeStorage.encryptString(plaintext)
      return `enc:v1:${buf.toString('base64')}`
    },
    decrypt: (encoded) => {
      if (!encoded.startsWith('enc:v1:')) {
        return encoded
      }
      const base64 = encoded.slice('enc:v1:'.length)
      try {
        const buf = Buffer.from(base64, 'base64')
        return safeStorage.decryptString(buf)
      } catch (error) {
        console.warn('[desktop-shell] safeStorage decryptString failed; treating apiKey as empty.', error)
        return ''
      }
    }
  }
}

export interface MainWindowOptions {
  width: number
  height: number
  minWidth: number
  minHeight: number
  show: boolean
  webPreferences: {
    preload: string
    contextIsolation: boolean
    nodeIntegration: boolean
    sandbox: boolean
  }
}

export const loadDevEnvFile = (projectRoot: string, filenames: readonly string[] = ['.env.local', '.env']): void => {
  for (const filename of filenames) {
    let content: string
    try {
      content = readFileSync(join(projectRoot, filename), 'utf8')
    } catch {
      continue
    }
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (line.length === 0 || line.startsWith('#')) continue
      const eqIndex = line.indexOf('=')
      if (eqIndex < 0) continue
      const key = line.slice(0, eqIndex).trim()
      if (key.length === 0) continue
      let value = line.slice(eqIndex + 1).trim()
      if (value.length >= 2) {
        const first = value.charAt(0)
        const last = value.charAt(value.length - 1)
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          value = value.slice(1, -1)
        }
      }
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}

export const applyDevOpenAiEnvOverrides = (
  snapshot: DesktopRuntimeStateSnapshot,
  env: NodeJS.ProcessEnv = process.env
): DesktopRuntimeStateSnapshot => {
  const apiKey = env['KUNLUN_OPENAI_API_KEY']
  const baseUrl = env['KUNLUN_OPENAI_BASE_URL']
  const model = env['KUNLUN_OPENAI_MODEL']
  const fallbackModelsRaw = env['KUNLUN_OPENAI_FALLBACK_MODELS']
  if (apiKey == null && baseUrl == null && model == null && fallbackModelsRaw == null) {
    return snapshot
  }
  const fallbackModels = fallbackModelsRaw == null
    ? undefined
    : fallbackModelsRaw
      .split(/[\n,]/u)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  const oai = snapshot.state.settings.openAiCompatible
  return {
    ...snapshot,
    state: {
      ...snapshot.state,
      settings: {
        ...snapshot.state.settings,
        openAiCompatible: {
          apiKey: apiKey ?? oai.apiKey,
          baseUrl: baseUrl ?? oai.baseUrl,
          model: model ?? oai.model,
          fallbackModels: fallbackModels ?? [...oai.fallbackModels]
        }
      }
    }
  }
}

export const resolveRendererEntryPath = (currentDir: string): string => {
  return join(currentDir, '../renderer/index.html')
}

export const resolvePreloadEntryPath = (currentDir: string): string => {
  return join(currentDir, '../preload/index.cjs')
}

export const createMainWindowOptions = (preloadPath: string): MainWindowOptions => ({
  width: 1440,
  height: 900,
  minWidth: 1200,
  minHeight: 760,
  show: false,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
})

export const runDesktopMainlineTurn = async (
  projectRoot: string,
  request: DesktopMainlineTurnRequest,
  stream: MainlineTurnStreamCallbacks = {}
): Promise<DesktopMainlineTurnResult> => {
  const parsedRuntimeState = parseDesktopRuntimeState(request.runtimeState)
  const result = await runMainlineTurn({
    projectRoot,
    nodeId: request.nodeId,
    attitudeChoiceMode: request.attitudeChoiceMode,
    runtimeState: parsedRuntimeState,
    recentTurns: request.recentTurns
  }, {}, stream)

  if (result.ok) {
    return {
      ok: true,
      currentNodeId: result.currentNodeId,
      chunks: result.chunks,
      combinedText: result.combinedText,
      options: result.options,
      completed: result.completed
    }
  }
  return {
    ok: false,
    reason: result.reason,
    message: result.message
  }
}

const toMainlineStreamChannel = (requestId: string): string => `desktop:mainline-turn-stream:${requestId}`

export const logDesktopShellBootstrapFailure = (error: unknown): void => {
  console.error('[desktop-shell] bootstrap failed', error)
}

export const resolveRuntimeSaveFilePath = (appDataDir: string): string => {
  return join(appDataDir, 'runtime-state.json')
}

export const loadDesktopRuntimeState = async (
  appDataDir: string,
  secretCipher?: SecretCipher
): Promise<DesktopRuntimeStateSnapshot> => {
  const result = await loadRuntimeState({
    storyOutline: mainlineStoryOutline,
    saveFilePath: resolveRuntimeSaveFilePath(appDataDir),
    ...(secretCipher != null ? { secretCipher } : {})
  })
  return createDesktopRuntimeStateSnapshot(result.state, result.recoveryAction)
}

export const saveDesktopRuntimeState = async (
  appDataDir: string,
  state: DesktopSerializedRuntimeState,
  secretCipher?: SecretCipher
): Promise<void> => {
  const validated = parseDesktopRuntimeState(state)
  await saveRuntimeState({
    saveFilePath: resolveRuntimeSaveFilePath(appDataDir),
    state: validated,
    ...(secretCipher != null ? { secretCipher } : {})
  })
}

const bootstrapDesktopShell = async (): Promise<void> => {
  const { app, BrowserWindow, ipcMain, safeStorage } = await import('electron')
  const desktopSecretCipher = createSafeStorageSecretCipher(safeStorage)

  if (!app.isPackaged) {
    loadDevEnvFile(process.cwd())
  }

  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFilePath)
  const preloadPath = resolvePreloadEntryPath(currentDir)
  const rendererEntryPath = resolveRendererEntryPath(currentDir)

  ipcMain.handle('desktop:ping', async () => 'pong')
  ipcMain.handle('desktop:quit-app', async () => {
    app.quit()
  })
  ipcMain.handle('desktop:get-startup-snapshot', async () => {
    return { appName: 'Kunlungame', shellReady: true } satisfies DesktopStartupSnapshot
  })
  ipcMain.handle('desktop:run-mainline-turn', async (_event, request: DesktopMainlineTurnRequest) => {
    return await runDesktopMainlineTurn(process.cwd(), request)
  })
  ipcMain.handle('desktop:stream-mainline-turn', async (event, requestId: string, request: DesktopMainlineTurnRequest) => {
    const channel = toMainlineStreamChannel(requestId)
    const send = (payload: DesktopMainlineTurnStreamEvent): void => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, payload)
    }
    try {
      const result = await runDesktopMainlineTurn(process.cwd(), request, {
        onChunk: (text) => send({ type: 'chunk', text }),
        onReset: () => send({ type: 'reset' })
      })
      send({ type: 'result', result })
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  })
  ipcMain.handle('desktop:load-runtime-state', async () => {
    const snapshot = await loadDesktopRuntimeState(app.getPath('userData'), desktopSecretCipher)
    return app.isPackaged ? snapshot : applyDevOpenAiEnvOverrides(snapshot)
  })
  ipcMain.handle('desktop:save-runtime-state', async (_event, state: DesktopSerializedRuntimeState) => {
    await saveDesktopRuntimeState(app.getPath('userData'), state, desktopSecretCipher)
  })
  ipcMain.handle('desktop:test-openai-compatible', async (_event, request: DesktopOpenAiCompatibleTestRequest) => {
    return await testOpenAiCompatibleConnection({
      apiKey: request?.apiKey ?? '',
      baseUrl: request?.baseUrl ?? '',
      model: request?.model ?? ''
    })
  })

  await app.whenReady()
  const window = new BrowserWindow(createMainWindowOptions(preloadPath))

  if (process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await window.loadFile(rendererEntryPath)
  }

  window.show()
}

if (process.env['VITEST'] !== 'true') {
  void bootstrapDesktopShell().catch(logDesktopShellBootstrapFailure)
}
