import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { minimalStoryOutline } from '../src/shared/contracts/contentContracts.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import {
  identitySecretCipher,
  loadRuntimeState,
  saveRuntimeState,
  type SecretCipher
} from '../src/runtime/saveRepository.js'

const buildFakeSafeStorageCipher = (
  options: { available: boolean } = { available: true }
): SecretCipher & { encryptCalls: string[]; decryptCalls: string[] } => {
  const encryptCalls: string[] = []
  const decryptCalls: string[] = []
  return {
    encryptCalls,
    decryptCalls,
    encrypt: (plaintext) => {
      encryptCalls.push(plaintext)
      if (!options.available || plaintext.length === 0) return plaintext
      return `enc:v1:${Buffer.from(plaintext, 'utf8').toString('base64')}`
    },
    decrypt: (encoded) => {
      decryptCalls.push(encoded)
      if (!encoded.startsWith('enc:v1:')) return encoded
      return Buffer.from(encoded.slice('enc:v1:'.length), 'base64').toString('utf8')
    }
  }
}

const stateWithApiKey = (apiKey: string) => {
  const state = createDefaultRuntimeState(minimalStoryOutline)
  return {
    ...state,
    settings: {
      ...state.settings,
      openAiCompatible: {
        ...state.settings.openAiCompatible,
        apiKey
      }
    }
  }
}

describe('saveRepository secretCipher integration', () => {
  it('encrypts apiKey on disk and decrypts on load', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlun-cipher-'))
    const saveFilePath = join(dir, 'runtime-state.json')
    const cipher = buildFakeSafeStorageCipher()

    await saveRuntimeState({
      saveFilePath,
      state: stateWithApiKey('sk-secret-123'),
      secretCipher: cipher
    })

    const onDisk = JSON.parse(await readFile(saveFilePath, 'utf8'))
    expect(onDisk.settings.openAiCompatible.apiKey).toMatch(/^enc:v1:/)
    expect(onDisk.settings.openAiCompatible.apiKey).not.toContain('sk-secret-123')

    const loaded = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath,
      secretCipher: cipher
    })
    expect(loaded.state.settings.openAiCompatible.apiKey).toBe('sk-secret-123')
    expect(loaded.recoveryAction).toBe('loaded-existing')
  })

  it('passes empty apiKey through without invoking encryption', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlun-cipher-'))
    const saveFilePath = join(dir, 'runtime-state.json')
    const cipher = buildFakeSafeStorageCipher()

    await saveRuntimeState({
      saveFilePath,
      state: stateWithApiKey(''),
      secretCipher: cipher
    })

    expect(cipher.encryptCalls).toEqual([])
    const onDisk = JSON.parse(await readFile(saveFilePath, 'utf8'))
    expect(onDisk.settings.openAiCompatible.apiKey).toBe('')
  })

  it('migrates legacy plaintext apiKey on disk by re-encrypting on next save', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlun-cipher-'))
    const saveFilePath = join(dir, 'runtime-state.json')

    // 老版本：不传 cipher，apiKey 作为明文落盘。
    await saveRuntimeState({
      saveFilePath,
      state: stateWithApiKey('legacy-plain-key')
    })
    const legacyOnDisk = JSON.parse(await readFile(saveFilePath, 'utf8'))
    expect(legacyOnDisk.settings.openAiCompatible.apiKey).toBe('legacy-plain-key')

    // 新版本：注入 cipher，加载明文 apiKey 不应崩，应原样回明文。
    const cipher = buildFakeSafeStorageCipher()
    const loaded = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath,
      secretCipher: cipher
    })
    expect(loaded.state.settings.openAiCompatible.apiKey).toBe('legacy-plain-key')

    // 写回时应当加密。
    await saveRuntimeState({
      saveFilePath,
      state: loaded.state,
      secretCipher: cipher
    })
    const reEncrypted = JSON.parse(await readFile(saveFilePath, 'utf8'))
    expect(reEncrypted.settings.openAiCompatible.apiKey).toMatch(/^enc:v1:/)
  })

  it('falls back to plaintext when safeStorage encryption is unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlun-cipher-'))
    const saveFilePath = join(dir, 'runtime-state.json')
    const cipher = buildFakeSafeStorageCipher({ available: false })

    await saveRuntimeState({
      saveFilePath,
      state: stateWithApiKey('plain-fallback-key'),
      secretCipher: cipher
    })

    const onDisk = JSON.parse(await readFile(saveFilePath, 'utf8'))
    expect(onDisk.settings.openAiCompatible.apiKey).toBe('plain-fallback-key')

    const loaded = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath,
      secretCipher: cipher
    })
    expect(loaded.state.settings.openAiCompatible.apiKey).toBe('plain-fallback-key')
  })

  it('default identity cipher keeps backward compatibility (no cipher arg)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kunlun-cipher-'))
    const saveFilePath = join(dir, 'runtime-state.json')

    await saveRuntimeState({
      saveFilePath,
      state: stateWithApiKey('pass-through')
    })
    const onDisk = JSON.parse(await readFile(saveFilePath, 'utf8'))
    expect(onDisk.settings.openAiCompatible.apiKey).toBe('pass-through')

    const loaded = await loadRuntimeState({
      storyOutline: minimalStoryOutline,
      saveFilePath
    })
    expect(loaded.state.settings.openAiCompatible.apiKey).toBe('pass-through')
    // identity 桩在导出层是明确导出的，便于其他模块复用。
    expect(identitySecretCipher.encrypt('x')).toBe('x')
    expect(identitySecretCipher.decrypt('y')).toBe('y')
  })
})
