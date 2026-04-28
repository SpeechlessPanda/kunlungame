import { describe, expect, it } from 'vitest'
import { createSafeStorageSecretCipher } from '../electron/main/index.js'

interface FakeSafeStorage {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (buf: Buffer) => string
}

const buildAvailableSafeStorage = (): FakeSafeStorage => ({
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from(`SEALED:${plain}`, 'utf8'),
  decryptString: (buf) => {
    const text = buf.toString('utf8')
    if (!text.startsWith('SEALED:')) throw new Error('not sealed')
    return text.slice('SEALED:'.length)
  }
})

describe('createSafeStorageSecretCipher', () => {
  it('encrypts non-empty plaintext with enc:v1: prefix and round-trips through decrypt', () => {
    const cipher = createSafeStorageSecretCipher(buildAvailableSafeStorage())
    const sealed = cipher.encrypt('sk-real-key')
    expect(sealed.startsWith('enc:v1:')).toBe(true)
    expect(sealed).not.toContain('sk-real-key')
    expect(cipher.decrypt(sealed)).toBe('sk-real-key')
  })

  it('returns empty string unchanged without invoking safeStorage', () => {
    let calls = 0
    const cipher = createSafeStorageSecretCipher({
      isEncryptionAvailable: () => true,
      encryptString: () => {
        calls += 1
        return Buffer.alloc(0)
      },
      decryptString: () => ''
    })
    expect(cipher.encrypt('')).toBe('')
    expect(calls).toBe(0)
  })

  it('returns plaintext unchanged on decrypt when value lacks enc:v1: prefix (legacy migration)', () => {
    const cipher = createSafeStorageSecretCipher(buildAvailableSafeStorage())
    expect(cipher.decrypt('legacy-plaintext')).toBe('legacy-plaintext')
  })

  it('falls back to identity behavior when safeStorage encryption is unavailable', () => {
    const cipher = createSafeStorageSecretCipher({
      isEncryptionAvailable: () => false,
      encryptString: () => {
        throw new Error('should not be called')
      },
      decryptString: () => {
        throw new Error('should not be called')
      }
    })
    expect(cipher.encrypt('sk-noop')).toBe('sk-noop')
    expect(cipher.decrypt('sk-noop')).toBe('sk-noop')
  })

  it('returns empty string when safeStorage.decryptString throws on a malformed enc:v1 payload', () => {
    const cipher = createSafeStorageSecretCipher({
      isEncryptionAvailable: () => true,
      encryptString: (plain) => Buffer.from(plain, 'utf8'),
      decryptString: () => {
        throw new Error('bad ciphertext')
      }
    })
    expect(cipher.decrypt('enc:v1:!!!not-base64!!!')).toBe('')
  })
})
