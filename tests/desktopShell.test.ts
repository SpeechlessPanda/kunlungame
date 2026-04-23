import { join, normalize } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDesktopBridge } from '../electron/preload/index.js'
import {
  buildDesktopStartupInput,
  runDesktopDialogueSmoke,
  buildDesktopStartupSnapshot,
  createMainWindowOptions,
  logDesktopShellBootstrapFailure,
  resolveRendererEntryPath
} from '../electron/main/index.js'

describe('createMainWindowOptions', () => {
  it('creates a secure preload-only BrowserWindow configuration', () => {
    const result = createMainWindowOptions('D:/project/kunlungame/dist-electron/preload/index.js')

    expect(result.width).toBe(1440)
    expect(result.height).toBe(900)
    expect(result.webPreferences?.preload).toBe('D:/project/kunlungame/dist-electron/preload/index.js')
    expect(result.webPreferences?.contextIsolation).toBe(true)
    expect(result.webPreferences?.nodeIntegration).toBe(false)
    expect(result.webPreferences?.sandbox).toBe(false)
  })
})

describe('resolveRendererEntryPath', () => {
  it('points production startup to the built renderer entry instead of the source html', () => {
    const result = resolveRendererEntryPath('D:/project/kunlungame/out/main')

    expect(normalize(result)).toBe(normalize(join('D:/project/kunlungame/out', 'renderer', 'index.html')))
  })
})

describe('buildDesktopStartupInput', () => {
  it('leaves GPU VRAM unknown until a real detector is wired in', () => {
    const result = buildDesktopStartupInput({
      isPackaged: false,
      projectRoot: 'D:/project/kunlungame',
      appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
    })

    expect(result.availableGpuVramGb).toBeNull()
    expect(result.preferredMode).toBe('default')
  })
})

describe('createDesktopBridge', () => {
  it('exposes only the expected desktop bridge methods', async () => {
    const bridge = createDesktopBridge({
      invoke: async (channel: string) => {
        if (channel === 'desktop:ping') {
          return 'pong'
        }

        if (channel === 'desktop:get-startup-snapshot') {
          return {
            appName: 'Kunlungame',
            shellReady: false,
            modelSetup: {
              selectedProfileId: 'qwen2.5-3b-instruct-q4km',
              shellAction: 'auto-download-required'
            }
          }
        }

        if (channel === 'desktop:run-dialogue-smoke') {
          return {
            selectedProfileId: 'qwen2.5-3b-instruct-q4km',
            currentNodeId: 'kunlun-threshold',
            fallbackUsed: false,
            chunkCount: 2,
            combinedText: '第一段。第二段。',
            options: [
              {
                semantic: 'align',
                label: '继续听'
              },
              {
                semantic: 'challenge',
                label: '先说理由'
              }
            ],
            completed: true
          }
        }

        throw new Error(`Unexpected channel: ${channel}`)
      }
    })

    expect(Object.keys(bridge).sort()).toEqual(['getStartupSnapshot', 'ping', 'runDialogueSmoke'])
    await expect(bridge.ping()).resolves.toBe('pong')
    await expect(bridge.getStartupSnapshot()).resolves.toMatchObject({
      appName: 'Kunlungame',
      modelSetup: {
        selectedProfileId: 'qwen2.5-3b-instruct-q4km'
      }
    })
    await expect(bridge.runDialogueSmoke()).resolves.toMatchObject({
      currentNodeId: 'kunlun-threshold',
      chunkCount: 2,
      completed: true
    })
  })
})

describe('buildDesktopStartupSnapshot', () => {
  it('adapts the model setup planner result into a shell-facing startup snapshot', async () => {
    const result = await buildDesktopStartupSnapshot(
      {
        preferredMode: 'default',
        availableGpuVramGb: 4,
        isPackaged: false,
        projectRoot: 'D:/project/kunlungame',
        appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
      },
      {
        buildSetupPlan: async () => ({
          shellAction: 'auto-download-required',
          autoDownload: true,
          selectedProfile: {
            id: 'qwen2.5-3b-instruct-q4km',
            label: 'Compatibility Mode',
            repository: 'Qwen/Qwen2.5-3B-Instruct-GGUF',
            quantization: 'Q4_K_M',
            files: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
            recommendedGpuVramGb: 6,
            contextWindow: 32768
          },
          selectedProfileAvailability: {
            profileId: 'qwen2.5-3b-instruct-q4km',
            status: 'missing',
            expectedFiles: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
            presentFiles: [],
            missingFiles: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
            completionRatio: 0,
            manifestDownloadedAt: null
          },
          fallbackProfileAvailability: {
            profileId: 'qwen2.5-3b-instruct-q4km',
            status: 'missing',
            expectedFiles: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
            presentFiles: [],
            missingFiles: ['qwen2.5-3b-instruct-q4_k_m.gguf'],
            completionRatio: 0,
            manifestDownloadedAt: null
          },
          uiContract: {
            channels: {
              startDownload: 'model-download:start',
              progress: 'model-download:progress',
              status: 'model-download:status',
              issue: 'model-download:issue',
              cancelDownload: 'model-download:cancel'
            },
            stages: ['checking', 'queued', 'downloading', 'switching-to-mirror', 'completed', 'failed'],
            recoveryActions: ['retry-download', 'open-network-help'],
            downloadSources: []
          },
          settingsEntryPoint: {
            defaultTab: 'models',
            highlightProfileId: 'qwen2.5-3b-instruct-q4km'
          }
        })
      }
    )

    expect(result.appName).toBe('Kunlungame')
    expect(result.shellReady).toBe(false)
    expect(result.modelSetup.selectedProfileId).toBe('qwen2.5-3b-instruct-q4km')
    expect(result.modelSetup.shellAction).toBe('auto-download-required')
  })
})

describe('logDesktopShellBootstrapFailure', () => {
  it('prints a stable bootstrap failure prefix for shell startup issues', () => {
    const messages: unknown[][] = []
    const originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      messages.push(args)
    }

    try {
      logDesktopShellBootstrapFailure(new Error('boom'))
    } finally {
      console.error = originalConsoleError
    }

    expect(messages).toHaveLength(1)
    expect(messages[0]?.[0]).toBe('[desktop-shell] bootstrap failed')
  })
})

describe('runDesktopDialogueSmoke', () => {
  it('adapts the smoke helper into a desktop-shell callable bridge result', async () => {
    const result = await runDesktopDialogueSmoke(
      {
        preferredMode: 'default',
        availableGpuVramGb: null,
        isPackaged: false,
        projectRoot: 'D:/project/kunlungame',
        appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
      },
      {
        runDialogueSmoke: async () => ({
          selectedProfileId: 'qwen2.5-3b-instruct-q4km',
          currentNodeId: 'kunlun-threshold',
          fallbackUsed: false,
          chunkCount: 2,
          combinedText: '第一段。第二段。',
          options: [
            {
              semantic: 'align',
              label: '继续听'
            },
            {
              semantic: 'challenge',
              label: '先说理由'
            }
          ],
          completed: true
        })
      }
    )

    expect(result.selectedProfileId).toBe('qwen2.5-3b-instruct-q4km')
    expect(result.currentNodeId).toBe('kunlun-threshold')
    expect(result.completed).toBe(true)
  })
})