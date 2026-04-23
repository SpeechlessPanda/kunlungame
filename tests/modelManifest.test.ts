import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { readModelManifest, writeModelManifest } from '../src/modeling/modelManifest.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      const { rm } = await import('node:fs/promises')
      await rm(dir, { force: true, recursive: true })
    })
  )
})

describe('modelManifest', () => {
  it('returns an empty manifest when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlungame-manifest-'))
    tempDirs.push(dir)

    await expect(readModelManifest(join(dir, 'manifest.json'))).resolves.toEqual({ records: [] })
  })

  it('round-trips manifest records', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlungame-manifest-'))
    tempDirs.push(dir)

    const manifestFile = join(dir, 'nested', 'manifest.json')
    const manifest = {
      records: [
        {
          profileId: 'qwen2.5-7b-instruct-q4km',
          files: ['part-1.gguf', 'part-2.gguf'],
          downloadedAt: '2026-04-23T12:00:00.000Z'
        }
      ]
    }

    await writeModelManifest(manifestFile, manifest)

    await expect(readModelManifest(manifestFile)).resolves.toEqual(manifest)
  })
})