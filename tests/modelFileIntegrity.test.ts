import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { parseModelArtifactMetadata, verifyModelArtifactFile } from '../src/modeling/modelFileIntegrity.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      const { rm } = await import('node:fs/promises')
      await rm(dir, { force: true, recursive: true })
    })
  )
})

describe('parseModelArtifactMetadata', () => {
  it('normalizes content length and x-linked-etag from response headers', () => {
    const result = parseModelArtifactMetadata({
      'content-length': '123',
      'x-linked-etag': '"ABCDEF0123"'
    })

    expect(result).toEqual({
      contentLength: 123,
      sha256: 'abcdef0123'
    })
  })
})

describe('verifyModelArtifactFile', () => {
  it('accepts a file when both size and sha256 match', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlungame-integrity-'))
    tempDirs.push(dir)
    const filePath = join(dir, 'artifact.gguf')
    await writeFile(filePath, 'kunlun')

    const result = await verifyModelArtifactFile(filePath, {
      contentLength: 6,
      sha256: '5edba3283300292e1b54490fc27dce4ba5cffebee57f1d292680aa8b0fc5fa19'
    })

    expect(result.ok).toBe(true)
    expect(result.sizeMatches).toBe(true)
    expect(result.hashMatches).toBe(true)
  })

  it('rejects a file when x-linked-etag sha256 does not match', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlungame-integrity-'))
    tempDirs.push(dir)
    const filePath = join(dir, 'artifact.gguf')
    await writeFile(filePath, 'kunlun')

    const result = await verifyModelArtifactFile(filePath, {
      contentLength: 6,
      sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    })

    expect(result.ok).toBe(false)
    expect(result.hashMatches).toBe(false)
  })
})