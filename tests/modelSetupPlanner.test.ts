import { describe, expect, it } from 'vitest'
import { buildModelDownloadIssueView, buildModelSetupPlan } from '../src/modeling/modelSetupPlanner.js'

describe('buildModelSetupPlan', () => {
  it('returns a ready startup action when the selected profile is fully available', async () => {
    const result = await buildModelSetupPlan(
      {
        entryPoint: 'startup',
        preferredMode: 'default',
        availableGpuVramGb: 10,
        isPackaged: true,
        projectRoot: 'D:/project/kunlungame',
        appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
      },
      {
        readManifest: async () => ({
          records: [
            {
              profileId: 'qwen2.5-7b-instruct-q4km',
              files: [
                'qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf',
                'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf'
              ],
              downloadedAt: '2026-04-23T12:00:00.000Z'
            }
          ]
        }),
        fileExists: async () => true
      }
    )

    expect(result.shellAction).toBe('launch-ready')
    expect(result.autoDownload).toBe(false)
    expect(result.selectedProfile.id).toBe('qwen2.5-7b-instruct-q4km')
    expect(result.uiContract.channels.startDownload).toBe('model-download:start')
  })

  it('requests startup auto download and exposes retry/mirror guidance when the selected profile is incomplete', async () => {
    const result = await buildModelSetupPlan(
      {
        entryPoint: 'startup',
        preferredMode: 'default',
        availableGpuVramGb: 8,
        isPackaged: false,
        projectRoot: 'D:/project/kunlungame',
        appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
      },
      {
        readManifest: async () => ({ records: [] }),
        fileExists: async (filePath) => filePath.endsWith('qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf')
      }
    )

    expect(result.shellAction).toBe('auto-download-required')
    expect(result.autoDownload).toBe(true)
    expect(result.selectedProfileAvailability.status).toBe('partial')
    expect(result.uiContract.recoveryActions).toContain('retry-download')
    expect(result.uiContract.recoveryActions).toContain('switch-to-mirror')
    expect(result.settingsEntryPoint.defaultTab).toBe('models')
  })

  it('keeps settings page in inspect mode instead of auto starting a download', async () => {
    const result = await buildModelSetupPlan(
      {
        entryPoint: 'settings',
        preferredMode: 'compatibility',
        availableGpuVramGb: 4,
        isPackaged: false,
        projectRoot: 'D:/project/kunlungame',
        appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
      },
      {
        readManifest: async () => ({ records: [] }),
        fileExists: async () => false
      }
    )

    expect(result.shellAction).toBe('settings-download-required')
    expect(result.autoDownload).toBe(false)
    expect(result.selectedProfile.id).toBe('qwen2.5-3b-instruct-q4km')
  })
})

describe('buildModelDownloadIssueView', () => {
  it('tells the UI to surface mirror switching and retry suggestions after a primary source failure', () => {
    const result = buildModelDownloadIssueView({
      failedSourceLabel: 'primary',
      hasMirrorSource: true,
      errorMessage: 'curl exited with code 35',
      preferredMode: 'default'
    })

    expect(result.stage).toBe('failed')
    expect(result.headline).toContain('下载失败')
    expect(result.recoveryActions).toContain('retry-download')
    expect(result.recoveryActions).toContain('switch-to-mirror')
    expect(result.suggestedFixes).toContain('检查网络连接或稍后重试。')
  })
})