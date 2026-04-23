import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { DesktopDialogueSmokeResult, DesktopStartupSnapshot } from '../../src/shared/types/desktop.js'
import { buildModelSetupPlan, type BuildModelSetupPlanInput } from '../../src/modeling/modelSetupPlanner.js'
import { runDialogueSmokeTest } from '../../src/modeling/dialogueSmokeTest.js'

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

export interface DesktopStartupInput extends Omit<BuildModelSetupPlanInput, 'entryPoint'> {}

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
    sandbox: false
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

export const logDesktopShellBootstrapFailure = (error: unknown): void => {
  console.error('[desktop-shell] bootstrap failed', error)
}

const bootstrapDesktopShell = async (): Promise<void> => {
  const { app, BrowserWindow, ipcMain } = await import('electron')

  const currentFilePath = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFilePath)
  const preloadPath = join(currentDir, '../preload/index.js')
  const rendererEntryPath = resolveRendererEntryPath(currentDir)

  ipcMain.handle('desktop:ping', async () => 'pong')
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