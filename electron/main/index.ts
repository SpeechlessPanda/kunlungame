import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type {
  DesktopDialogueSmokeResult,
  DesktopDownloadProfileResult,
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnResult,
  DesktopMainlineTurnStreamEvent,
  DesktopOpenAiCompatibleTestRequest,
  DesktopProfileAvailability,
  DesktopProfileDownloadProgressEvent,
  DesktopRuntimeStateSnapshot,
  DesktopSerializedRuntimeState,
  DesktopStartupSnapshot
} from '../../src/shared/types/desktop.js'
import { testOpenAiCompatibleConnection } from '../../src/modeling/openAiCompatibleConnectionTest.js'
import { buildModelSetupPlan, evaluateSingleProfileAvailability, type BuildModelSetupPlanInput } from '../../src/modeling/modelSetupPlanner.js'
import { runDialogueSmokeTest } from '../../src/modeling/dialogueSmokeTest.js'
import { runMainlineTurn, type MainlineTurnStreamCallbacks } from '../../src/modeling/mainlineTurnRunner.js'
import { findModelProfileById } from '../../src/modeling/modelProfiles.js'
import { resolveModelStoragePaths } from '../../src/modeling/modelPaths.js'
import {
  buildDefaultProfileDownloaderDependencies,
  downloadProfileWeights,
  type ProfileDownloadProgressEvent,
  type ProfileDownloaderDependencies
} from '../../src/modeling/profileDownloader.js'
import {
  createDesktopRuntimeStateSnapshot,
  parseDesktopRuntimeState
} from '../../src/runtime/runtimeStateFacade.js'
import { loadRuntimeState, saveRuntimeState, type SecretCipher } from '../../src/runtime/saveRepository.js'
import { mainlineStoryOutline } from '../../src/content/source/mainlineOutline.js'

/**
 * 在 Electron 环境里基于 `safeStorage` 构造 SecretCipher。
 * - 只在 `safeStorage.isEncryptionAvailable()` 为 true 时返回加密实现；
 * - 输出格式：`enc:v1:<base64(safeStorage.encryptString)>`。
 * - 读盘时只对以 `enc:v1:` 开头的值调 `decryptString`，原生明文原样返回，
 *   这让旧版本进入本版本不会丢失现有用户设置。
 */
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

export interface DesktopStartupInput extends Omit<BuildModelSetupPlanInput, 'entryPoint'> { }

export interface DesktopStartupDependencies {
  buildSetupPlan: (input: BuildModelSetupPlanInput) => Promise<Awaited<ReturnType<typeof buildModelSetupPlan>>>
  runDialogueSmoke: (input: DesktopStartupInput) => Promise<DesktopDialogueSmokeResult>
}

const defaultStartupDependencies: DesktopStartupDependencies = {
  buildSetupPlan: buildModelSetupPlan,
  runDialogueSmoke: runDialogueSmokeTest
}

export const resolveRendererEntryPath = (currentDir: string): string => {
  return join(currentDir, '../renderer/index.html')
}

export const resolvePreloadEntryPath = (currentDir: string): string => {
  return join(currentDir, '../preload/index.cjs')
}

export const buildDesktopStartupInput = (input: {
  isPackaged: boolean
  projectRoot: string
  appDataDir: string
}): DesktopStartupInput => ({
  preferredMode: 'default',
  availableGpuVramGb: null,
  isPackaged: input.isPackaged,
  projectRoot: input.projectRoot,
  appDataDir: input.appDataDir
})

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
    // 安全基线：启用 sandbox。preload 仅使用 electron 模块（contextBridge / ipcRenderer），
    // 不依赖 fs/path 等 Node API，因此对 sandbox 兼容。任何需要文件/进程权限的能力
    // 都必须通过主进程 IPC 暴露，而非在渲染层直连。
    sandbox: true
  }
})

export const buildDesktopStartupSnapshot = async (
  input: DesktopStartupInput,
  dependencies: Partial<DesktopStartupDependencies> = {}
): Promise<DesktopStartupSnapshot> => {
  const resolvedDependencies = {
    ...defaultStartupDependencies,
    ...dependencies
  }
  const result = await resolvedDependencies.buildSetupPlan({
    ...input,
    entryPoint: 'startup'
  })

  return {
    appName: 'Kunlungame',
    shellReady: result.shellAction === 'launch-ready',
    modelSetup: {
      selectedProfileId: result.selectedProfile.id,
      shellAction: result.shellAction
    }
  }
}

export const runDesktopDialogueSmoke = async (
  input: DesktopStartupInput,
  dependencies: Partial<DesktopStartupDependencies> = {}
): Promise<DesktopDialogueSmokeResult> => {
  const resolvedDependencies = {
    ...defaultStartupDependencies,
    ...dependencies
  }

  return await resolvedDependencies.runDialogueSmoke(input)
}

export const runDesktopMainlineTurn = async (
  startupInput: DesktopStartupInput,
  request: DesktopMainlineTurnRequest,
  stream: MainlineTurnStreamCallbacks = {}
): Promise<DesktopMainlineTurnResult> => {
  const parsedRuntimeState = parseDesktopRuntimeState(request.runtimeState)
  // 用存档里持久化的用户偏好覆写 startupInput.preferredMode，
  // 这样 Settings 面板一旦切换档位，下一轮就会加载对应的模型。
  const effectiveStartupInput: DesktopStartupInput = {
    ...startupInput,
    preferredMode: parsedRuntimeState.settings.preferredModelMode
  }
  const result = await runMainlineTurn({
    ...effectiveStartupInput,
    nodeId: request.nodeId,
    attitudeChoiceMode: request.attitudeChoiceMode,
    runtimeState: parsedRuntimeState,
    recentTurns: request.recentTurns
  }, {}, stream)
  if (result.ok) {
    return {
      ok: true,
      selectedProfileId: result.selectedProfileId,
      modelPath: result.modelPath,
      currentNodeId: result.currentNodeId,
      fallbackUsed: result.fallbackUsed,
      chunks: result.chunks,
      combinedText: result.combinedText,
      options: result.options,
      completed: result.completed
    }
  }
  return {
    ok: false,
    reason: result.reason,
    message: result.message,
    ...(result.modelPath != null ? { modelPath: result.modelPath } : {})
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

const resolveDesktopModelStorage = (input: { isPackaged: boolean; projectRoot: string; appDataDir: string }) => {
  return resolveModelStoragePaths({
    isPackaged: input.isPackaged,
    projectRoot: input.projectRoot,
    appDataDir: input.appDataDir
  })
}

export const getDesktopProfileAvailability = async (
  input: { isPackaged: boolean; projectRoot: string; appDataDir: string },
  profileId: string
): Promise<DesktopProfileAvailability> => {
  const profile = findModelProfileById(profileId)
  if (profile == null) {
    return {
      profileId,
      status: 'missing',
      expectedFiles: [],
      presentFiles: [],
      missingFiles: [],
      completionRatio: 0,
      manifestDownloadedAt: null
    }
  }
  const storage = resolveDesktopModelStorage(input)
  const availability = await evaluateSingleProfileAvailability(profile, storage)
  return {
    profileId: availability.profileId,
    status: availability.status,
    expectedFiles: availability.expectedFiles,
    presentFiles: availability.presentFiles,
    missingFiles: availability.missingFiles,
    completionRatio: availability.completionRatio,
    manifestDownloadedAt: availability.manifestDownloadedAt
  }
}

const toDesktopProgressEvent = (event: ProfileDownloadProgressEvent): DesktopProfileDownloadProgressEvent => ({
  profileId: event.profileId,
  fileName: event.fileName,
  phase: event.phase,
  fileIndex: event.fileIndex,
  totalFiles: event.totalFiles,
  message: event.message,
  bytesDownloaded: event.bytesDownloaded,
  totalBytes: event.totalBytes
})

export interface DesktopDownloadProfileDependencies {
  buildDependencies: () => Promise<ProfileDownloaderDependencies>
}

const activeDesktopDownloads = new Set<string>()

export const runDesktopProfileDownload = async (
  input: { isPackaged: boolean; projectRoot: string; appDataDir: string },
  profileId: string,
  onProgress: (event: DesktopProfileDownloadProgressEvent) => void,
  dependencies: Partial<DesktopDownloadProfileDependencies> = {}
): Promise<DesktopDownloadProfileResult> => {
  const profile = findModelProfileById(profileId)
  if (profile == null) {
    return { ok: false, profileId, reason: 'unknown-profile', message: `未知的 profile id: ${profileId}` }
  }
  if (activeDesktopDownloads.has(profileId)) {
    return { ok: false, profileId, reason: 'already-running', message: `${profile.label} 已在下载中` }
  }
  // 立即占位：避免 "check 与 add 之间仍朊 wait" 造成的并发竞态
  // （两个快速连发的 IPC 调用都能跳过上面的检查、同时进入 downloadProfileWeights）。
  activeDesktopDownloads.add(profileId)

  const storage = resolveDesktopModelStorage(input)
  let deps: ProfileDownloaderDependencies
  try {
    deps = await (dependencies.buildDependencies ?? buildDefaultProfileDownloaderDependencies)()
  } catch (error) {
    activeDesktopDownloads.delete(profileId)
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, profileId, reason: 'download-failed', message: `构建下载依赖失败: ${message}` }
  }

  try {
    const result = await downloadProfileWeights({
      profile,
      storage,
      deps,
      onProgress: (event) => onProgress(toDesktopProgressEvent(event))
    })
    if (result.ok) {
      return { ok: true, profileId }
    }
    return { ok: false, profileId, reason: 'download-failed', message: result.errorMessage ?? '下载失败' }
  } finally {
    activeDesktopDownloads.delete(profileId)
  }
}

const bootstrapDesktopShell = async (): Promise<void> => {
  const { app, BrowserWindow, ipcMain, safeStorage } = await import('electron')
  const desktopSecretCipher = createSafeStorageSecretCipher(safeStorage)

  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFilePath)
  const preloadPath = resolvePreloadEntryPath(currentDir)
  const rendererEntryPath = resolveRendererEntryPath(currentDir)

  ipcMain.handle('desktop:ping', async () => 'pong')
  ipcMain.handle('desktop:quit-app', async () => {
    // 用在结尾页"退出游戏"按钮：让用户主动结束本次旅程，对应 mainlineOutline 的最终节点。
    app.quit()
  })
  ipcMain.handle('desktop:get-startup-snapshot', async () => {
    return await buildDesktopStartupSnapshot(buildDesktopStartupInput({
      isPackaged: app.isPackaged,
      projectRoot: process.cwd(),
      appDataDir: app.getPath('userData')
    }))
  })
  ipcMain.handle('desktop:run-dialogue-smoke', async () => {
    return await runDesktopDialogueSmoke(buildDesktopStartupInput({
      isPackaged: app.isPackaged,
      projectRoot: process.cwd(),
      appDataDir: app.getPath('userData')
    }))
  })
  ipcMain.handle('desktop:run-mainline-turn', async (_event, request: DesktopMainlineTurnRequest) => {
    return await runDesktopMainlineTurn(
      buildDesktopStartupInput({
        isPackaged: app.isPackaged,
        projectRoot: process.cwd(),
        appDataDir: app.getPath('userData')
      }),
      request
    )
  })
  ipcMain.handle('desktop:stream-mainline-turn', async (event, requestId: string, request: DesktopMainlineTurnRequest) => {
    const channel = toMainlineStreamChannel(requestId)
    const send = (payload: DesktopMainlineTurnStreamEvent): void => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, payload)
    }

    try {
      const result = await runDesktopMainlineTurn(
        buildDesktopStartupInput({
          isPackaged: app.isPackaged,
          projectRoot: process.cwd(),
          appDataDir: app.getPath('userData')
        }),
        request,
        {
          onChunk: (text) => send({ type: 'chunk', text }),
          onReset: () => send({ type: 'reset' })
        }
      )
      send({ type: 'result', result })
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  })
  ipcMain.handle('desktop:load-runtime-state', async () => {
    return await loadDesktopRuntimeState(app.getPath('userData'), desktopSecretCipher)
  })
  ipcMain.handle('desktop:save-runtime-state', async (_event, state: DesktopSerializedRuntimeState) => {
    await saveDesktopRuntimeState(app.getPath('userData'), state, desktopSecretCipher)
  })

  ipcMain.handle('desktop:get-profile-availability', async (_event, profileId: string) => {
    return await getDesktopProfileAvailability(
      {
        isPackaged: app.isPackaged,
        projectRoot: process.cwd(),
        appDataDir: app.getPath('userData')
      },
      profileId
    )
  })

  ipcMain.handle('desktop:test-openai-compatible', async (_event, request: DesktopOpenAiCompatibleTestRequest) => {
    return await testOpenAiCompatibleConnection({
      apiKey: request?.apiKey ?? '',
      baseUrl: request?.baseUrl ?? '',
      model: request?.model ?? ''
    })
  })

  ipcMain.handle('desktop:download-profile', async (event, profileId: string) => {
    return await runDesktopProfileDownload(
      {
        isPackaged: app.isPackaged,
        projectRoot: process.cwd(),
        appDataDir: app.getPath('userData')
      },
      profileId,
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:profile-download-progress', progress)
        }
      }
    )
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