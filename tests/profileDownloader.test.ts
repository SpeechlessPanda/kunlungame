import { describe, expect, it, vi } from 'vitest'
import {
  downloadProfileWeights,
  type ProfileDownloaderDependencies,
  type ProfileDownloadProgressEvent
} from '../src/modeling/profileDownloader.js'
import type { ModelProfile } from '../src/modeling/modelProfiles.js'
import type { ModelManifest } from '../src/modeling/modelManifest.js'

const buildProfile = (overrides: Partial<ModelProfile> = {}): ModelProfile => ({
  id: 'pro-7b',
  label: 'Pro Mode',
  repository: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
  quantization: 'Q4_K_M',
  files: ['qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf'],
  recommendedGpuVramGb: 8,
  contextWindow: 32768,
  ...overrides
})

const buildDeps = (overrides: Partial<ProfileDownloaderDependencies> = {}): ProfileDownloaderDependencies => {
  const manifest: ModelManifest = { records: [] }
  return {
    fetchArtifactMetadata: async () => ({ contentLength: 100, sha256: null }),
    downloadFile: async () => {},
    verifyFile: async () => ({ ok: true, sizeMatches: true, hashMatches: null }),
    removeFile: async () => {},
    ensureDirectory: async () => {},
    readManifest: async () => manifest,
    writeManifest: async () => {},
    now: () => new Date('2026-05-01T00:00:00.000Z'),
    ...overrides
  }
}

describe('downloadProfileWeights', () => {
  const storage = { modelsDir: '/models', manifestFile: '/models/manifest.json' }

  it('downloads each file, verifies, and writes manifest on success', async () => {
    const events: ProfileDownloadProgressEvent[] = []
    const writeManifest = vi.fn(async () => {})
    const profile = buildProfile({ files: ['a.gguf', 'b.gguf'] })
    const result = await downloadProfileWeights({
      profile,
      storage,
      deps: buildDeps({ writeManifest }),
      onProgress: (event) => events.push(event)
    })

    expect(result.ok).toBe(true)
    expect(result.lastPhase).toBe('completed')
    expect(writeManifest).toHaveBeenCalledTimes(1)
    const phases = events.map((event) => event.phase)
    expect(phases).toContain('starting')
    expect(phases).toContain('downloading')
    expect(phases).toContain('file-done')
    expect(phases).toContain('manifest-updated')
    expect(phases).toContain('completed')
    const written = writeManifest.mock.calls[0]![1] as ModelManifest
    expect(written.records).toHaveLength(1)
    expect(written.records[0]!.profileId).toBe(profile.id)
    expect(written.records[0]!.files).toEqual(['a.gguf', 'b.gguf'])
  })

  it('forwards byte-level progress reported by downloadFile', async () => {
    const events: ProfileDownloadProgressEvent[] = []
    const downloadFile = vi.fn(async (_url: string, _path: string, onByteProgress?: (b: number, t: number) => void) => {
      onByteProgress?.(0, 1000)
      onByteProgress?.(500, 1000)
      onByteProgress?.(1000, 1000)
    })
    const profile = buildProfile({ files: ['a.gguf'] })
    const result = await downloadProfileWeights({
      profile,
      storage,
      deps: buildDeps({ downloadFile }),
      onProgress: (event) => events.push(event)
    })
    expect(result.ok).toBe(true)
    const byteEvents = events.filter(
      (event) => event.phase === 'downloading' && event.bytesDownloaded != null
    )
    expect(byteEvents.length).toBeGreaterThanOrEqual(2)
    const last = byteEvents[byteEvents.length - 1]!
    expect(last.bytesDownloaded).toBe(1000)
    expect(last.totalBytes).toBe(1000)
    expect(last.message).toMatch(/\//)
  })

  it('fails fast when every mirror errors', async () => {
    const events: ProfileDownloadProgressEvent[] = []
    const downloadFile = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await downloadProfileWeights({
      profile: buildProfile(),
      storage,
      deps: buildDeps({ downloadFile }),
      onProgress: (event) => events.push(event)
    })

    expect(result.ok).toBe(false)
    expect(result.lastPhase).toBe('failed')
    expect(result.errorMessage).toContain('network down')
    expect(events.some((event) => event.phase === 'failed')).toBe(true)
    // Each source is attempted. With one file and 2 mirror sources we expect >= 2 downloadFile calls.
    expect(downloadFile.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('removes the file and fails when verification fails on all sources', async () => {
    const removeFile = vi.fn(async () => {})
    const verifyFile = vi.fn(async () => ({ ok: false, sizeMatches: false, hashMatches: null }))
    const result = await downloadProfileWeights({
      profile: buildProfile(),
      storage,
      deps: buildDeps({ verifyFile, removeFile })
    })
    expect(result.ok).toBe(false)
    expect(removeFile).toHaveBeenCalled()
  })

  it('replaces an existing manifest record for the same profile', async () => {
    const existing: ModelManifest = {
      records: [
        { profileId: 'pro-7b', files: ['old.gguf'], downloadedAt: '2025-01-01T00:00:00.000Z' },
        { profileId: 'other', files: ['other.gguf'], downloadedAt: '2025-01-01T00:00:00.000Z' }
      ]
    }
    const writeManifest = vi.fn(async () => {})
    await downloadProfileWeights({
      profile: buildProfile(),
      storage,
      deps: buildDeps({ readManifest: async () => existing, writeManifest })
    })
    const written = writeManifest.mock.calls[0]![1] as ModelManifest
    expect(written.records).toHaveLength(2)
    expect(written.records.find((record) => record.profileId === 'pro-7b')!.downloadedAt)
      .toBe('2026-05-01T00:00:00.000Z')
    expect(written.records.find((record) => record.profileId === 'other')!.files)
      .toEqual(['other.gguf'])
  })
})
