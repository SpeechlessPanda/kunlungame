import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createDesktopBridge } from '../electron/preload/index.js'
import {
  buildDesktopStartupInput,
  runDesktopDialogueSmoke,
  buildDesktopStartupSnapshot,
  createMainWindowOptions,
  logDesktopShellBootstrapFailure,
  resolveRendererEntryPath,
  resolveRuntimeSaveFilePath,
  loadDesktopRuntimeState,
  saveDesktopRuntimeState
} from '../electron/main/index.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'

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

    expect(Object.keys(bridge).sort()).toEqual(
      ['downloadProfile', 'getProfileAvailability', 'getStartupSnapshot', 'loadRuntimeState', 'onProfileDownloadProgress', 'ping', 'quitApp', 'runDialogueSmoke', 'runMainlineTurn', 'saveRuntimeState']
    )
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

describe('resolveRuntimeSaveFilePath', () => {
  it('places the persistent runtime state inside the electron userData dir', () => {
    const result = resolveRuntimeSaveFilePath('C:/Users/test/AppData/Roaming/Kunlungame')
    expect(normalize(result)).toBe(
      normalize(join('C:/Users/test/AppData/Roaming/Kunlungame', 'runtime-state.json'))
    )
  })
})

describe('desktop runtime state save/load roundtrip', () => {
  it('initializes default state the first time and reloads what was saved afterwards', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-runtime-'))
    try {
      const first = await loadDesktopRuntimeState(tempDir)
      expect(first.recoveryAction).toBe('created-default')
      expect(first.state.currentNodeId).toBe(mainlineStoryOutline.entryNodeId)

      const nextState = createDefaultRuntimeState(mainlineStoryOutline)
      const advanced = {
        ...nextState,
        currentNodeId: 'creation-myths',
        turnIndex: 2,
        attitudeScore: 2,
        readNodeIds: ['kunlun-threshold']
      }
      await saveDesktopRuntimeState(tempDir, advanced)

      const reloaded = await loadDesktopRuntimeState(tempDir)
      expect(reloaded.recoveryAction).toBe('loaded-existing')
      expect(reloaded.state.currentNodeId).toBe('creation-myths')
      expect(reloaded.state.turnIndex).toBe(2)
      expect(reloaded.state.attitudeScore).toBe(2)
      expect(reloaded.state.readNodeIds).toEqual(['kunlun-threshold'])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('resets runtime state when the on-disk payload is corrupted', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-runtime-'))
    try {
      await writeFile(resolveRuntimeSaveFilePath(tempDir), '{not json', 'utf-8')
      const snapshot = await loadDesktopRuntimeState(tempDir)
      expect(snapshot.recoveryAction).toBe('reset-corrupted')
      expect(snapshot.state.currentNodeId).toBe(mainlineStoryOutline.entryNodeId)
      const written = await readFile(resolveRuntimeSaveFilePath(tempDir), 'utf-8')
      expect(() => JSON.parse(written)).not.toThrow()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects invalid runtime state shapes when saving', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlungame-runtime-'))
    try {
      await expect(
        saveDesktopRuntimeState(tempDir, {
          saveVersion: 99 as unknown as 1,
          currentNodeId: 'x',
          turnIndex: -1,
          attitudeScore: 9999,
          historySummary: '',
          readNodeIds: [],
          settings: { bgmEnabled: true, preferredModelMode: 'default' }
        })
      ).rejects.toBeTruthy()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})

import { getDesktopProfileAvailability, runDesktopProfileDownload } from '../electron/main/index.js'
import { getProModelProfile } from '../src/modeling/modelProfiles.js'

describe('getDesktopProfileAvailability', () => {
  it('returns missing status when the weight files are absent on disk', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlun-avail-'))
    try {
      const availability = await getDesktopProfileAvailability(
        { isPackaged: false, projectRoot: tempDir, appDataDir: tempDir },
        getProModelProfile().id
      )
      expect(availability.profileId).toBe(getProModelProfile().id)
      expect(availability.status).toBe('missing')
      expect(availability.missingFiles.length).toBeGreaterThan(0)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('returns missing/empty for an unknown profile id', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlun-avail-'))
    try {
      const availability = await getDesktopProfileAvailability(
        { isPackaged: false, projectRoot: tempDir, appDataDir: tempDir },
        'not-a-real-profile'
      )
      expect(availability.status).toBe('missing')
      expect(availability.expectedFiles).toEqual([])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})

describe('runDesktopProfileDownload', () => {
  it('rejects unknown profile ids', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlun-dl-'))
    try {
      const result = await runDesktopProfileDownload(
        { isPackaged: false, projectRoot: tempDir, appDataDir: tempDir },
        'nope',
        () => {},
        {
          buildDependencies: async () => ({
            fetchArtifactMetadata: async () => null,
            downloadFile: async () => {},
            verifyFile: async () => ({ ok: true, sizeMatches: true, hashMatches: null }),
            removeFile: async () => {},
            ensureDirectory: async () => {},
            readManifest: async () => ({ records: [] }),
            writeManifest: async () => {}
          })
        }
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('unknown-profile')
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('runs the injected downloader and forwards progress events', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kunlun-dl-'))
    try {
      const progressEvents: Array<{ phase: string; profileId: string }> = []
      const result = await runDesktopProfileDownload(
        { isPackaged: false, projectRoot: tempDir, appDataDir: tempDir },
        getProModelProfile().id,
        (event) => progressEvents.push({ phase: event.phase, profileId: event.profileId }),
        {
          buildDependencies: async () => ({
            fetchArtifactMetadata: async () => ({ contentLength: null, sha256: null }),
            downloadFile: async () => {},
            verifyFile: async () => ({ ok: true, sizeMatches: true, hashMatches: null }),
            removeFile: async () => {},
            ensureDirectory: async () => {},
            readManifest: async () => ({ records: [] }),
            writeManifest: async () => {}
          })
        }
      )
      expect(result.ok).toBe(true)
      expect(progressEvents.some((event) => event.phase === 'completed')).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
