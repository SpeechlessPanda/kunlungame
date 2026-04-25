import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  downloadAndSmokeTestProfile,
  type ModelDownloadWorkflowDependencies
} from '../src/modeling/modelDownloadWorkflow.js'
import type { ModelManifest } from '../src/modeling/modelManifest.js'
import type { ModelProfile } from '../src/modeling/modelProfiles.js'
import type { DownloadProfileInput, DownloadProfileResult } from '../src/modeling/profileDownloader.js'

const profile: ModelProfile = {
  id: 'qwen-test',
  label: 'Qwen Test',
  repository: 'Qwen/Test-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen-test.gguf'],
  recommendedGpuVramGb: 4,
  contextWindow: 4096
}

const storage = {
  modelsDir: 'D:/models',
  manifestFile: 'D:/models/manifest.json'
}

const okDownload: DownloadProfileResult = {
  ok: true,
  profileId: profile.id,
  lastPhase: 'completed'
}

const buildDeps = (overrides: Partial<ModelDownloadWorkflowDependencies> = {}): ModelDownloadWorkflowDependencies => {
  const manifest: ModelManifest = {
    records: [
      {
        profileId: profile.id,
        files: [...profile.files],
        downloadedAt: '2026-04-25T00:00:00.000Z',
        verifiedAt: '2026-04-25T00:00:00.000Z'
      }
    ]
  }
  return {
    downloadProfileWeights: vi.fn(async () => okDownload),
    runSmokeTest: vi.fn(async () => {}),
    removeDirectory: vi.fn(async () => {}),
    readManifest: vi.fn(async () => manifest),
    writeManifest: vi.fn(async (_file: string, nextManifest: ModelManifest) => {
      manifest.records = nextManifest.records
    }),
    now: () => new Date('2026-04-25T01:00:00.000Z'),
    ...overrides
  }
}

describe('downloadAndSmokeTestProfile', () => {
  it('uses the shared profile downloader and records smoke-tested manifest state', async () => {
    const deps = buildDeps()
    await downloadAndSmokeTestProfile({
      profile,
      storage,
      downloaderDeps: {} as never,
      deps
    })

    expect(deps.downloadProfileWeights).toHaveBeenCalledTimes(1)
    const call = vi.mocked(deps.downloadProfileWeights).mock.calls[0]![0] as DownloadProfileInput
    expect(call.profile).toBe(profile)
    expect(call.storage).toBe(storage)
    expect(deps.runSmokeTest).toHaveBeenCalledWith({
      profileId: profile.id,
      modelPath: join(storage.modelsDir, profile.id, profile.files[0]!)
    })
    const written = vi.mocked(deps.writeManifest).mock.calls.at(-1)![1]
    expect(written.records.find((record) => record.profileId === profile.id)?.smokeTestedAt)
      .toBe('2026-04-25T01:00:00.000Z')
  })

  it('removes the profile directory and retries when smoke testing fails once', async () => {
    const runSmokeTest = vi
      .fn<(input: { profileId: string; modelPath: string }) => Promise<void>>()
      .mockRejectedValueOnce(new Error('bad weights'))
      .mockResolvedValueOnce(undefined)
    const deps = buildDeps({ runSmokeTest })

    await downloadAndSmokeTestProfile({
      profile,
      storage,
      downloaderDeps: {} as never,
      repairAttempts: 2,
      deps
    })

    expect(deps.downloadProfileWeights).toHaveBeenCalledTimes(2)
    expect(deps.removeDirectory).toHaveBeenCalledWith(join(storage.modelsDir, profile.id))
    expect(deps.writeManifest).toHaveBeenCalled()
  })

  it('clears the manifest record and throws when smoke testing never passes', async () => {
    const deps = buildDeps({
      runSmokeTest: vi.fn(async () => {
        throw new Error('still broken')
      })
    })

    await expect(
      downloadAndSmokeTestProfile({
        profile,
        storage,
        downloaderDeps: {} as never,
        repairAttempts: 1,
        deps
      })
    ).rejects.toThrow('still broken')

    const written = vi.mocked(deps.writeManifest).mock.calls.at(-1)![1]
    expect(written.records.some((record) => record.profileId === profile.id)).toBe(false)
  })
})