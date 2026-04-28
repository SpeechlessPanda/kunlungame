import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StoryOutline } from '../shared/contracts/contentContracts.js'
import {
  createDefaultRuntimeState,
  deserializeRuntimeState,
  resolveRuntimeStateAgainstStoryOutline,
  serializeRuntimeState,
  type RuntimeState
} from './runtimeState.js'

export type RuntimeStateRecoveryAction = 'created-default' | 'loaded-existing' | 'reset-corrupted'

/**
 * 用于在落盘前/读盘后变换 `settings.openAiCompatible.apiKey` 等敏感字段。
 * - `encrypt`：把明文 apiKey 转成可安全落盘的不透明字符串（带 `enc:` 前缀）。
 * - `decrypt`：把磁盘上的字符串还原成明文；若未加密（无 `enc:` 前缀）原样返回。
 *
 * 默认实现是 identity（保持向后兼容、便于纯测试）；electron 主进程会注入基于
 * `safeStorage.encryptString` 的实现；若目标平台支持 safeStorage，明文 apiKey 不会直接落到 runtime-state.json。
 */
export interface SecretCipher {
  encrypt: (plaintext: string) => string
  decrypt: (encoded: string) => string
}

export const identitySecretCipher: SecretCipher = {
  encrypt: (plaintext) => plaintext,
  decrypt: (encoded) => encoded
}

export interface LoadRuntimeStateInput {
  storyOutline: StoryOutline
  saveFilePath: string
  secretCipher?: SecretCipher
}

export interface LoadRuntimeStateResult {
  state: RuntimeState
  recoveryAction: RuntimeStateRecoveryAction
}

export interface SaveRuntimeStateInput {
  saveFilePath: string
  state: RuntimeState
  secretCipher?: SecretCipher
}

const cloneStateWithEncryptedApiKey = (state: RuntimeState, cipher: SecretCipher): RuntimeState => {
  const apiKey = state.settings.openAiCompatible.apiKey
  return {
    ...state,
    settings: {
      ...state.settings,
      openAiCompatible: {
        ...state.settings.openAiCompatible,
        // 明文为空就别加密，避免在磁盘里留一段没有意义的密文。
        apiKey: apiKey.length === 0 ? '' : cipher.encrypt(apiKey)
      }
    }
  }
}

const decryptApiKeyOnRawJson = (rawJson: unknown, cipher: SecretCipher): unknown => {
  if (rawJson == null || typeof rawJson !== 'object') {
    return rawJson
  }
  const root = rawJson as Record<string, unknown>
  const settings = root.settings
  if (settings == null || typeof settings !== 'object') {
    return rawJson
  }
  const settingsRecord = settings as Record<string, unknown>
  const openAi = settingsRecord.openAiCompatible
  if (openAi == null || typeof openAi !== 'object') {
    return rawJson
  }
  const openAiRecord = openAi as Record<string, unknown>
  if (typeof openAiRecord.apiKey !== 'string' || openAiRecord.apiKey.length === 0) {
    return rawJson
  }
  return {
    ...root,
    settings: {
      ...settingsRecord,
      openAiCompatible: {
        ...openAiRecord,
        apiKey: cipher.decrypt(openAiRecord.apiKey)
      }
    }
  }
}

const persistState = async (
  saveFilePath: string,
  state: RuntimeState,
  cipher: SecretCipher
): Promise<void> => {
  await mkdir(dirname(saveFilePath), { recursive: true })
  const encrypted = cloneStateWithEncryptedApiKey(state, cipher)
  await writeFile(saveFilePath, serializeRuntimeState(encrypted), 'utf8')
}

export const saveRuntimeState = async (input: SaveRuntimeStateInput): Promise<void> => {
  const cipher = input.secretCipher ?? identitySecretCipher
  await persistState(input.saveFilePath, input.state, cipher)
}

export const loadRuntimeState = async (input: LoadRuntimeStateInput): Promise<LoadRuntimeStateResult> => {
  const cipher = input.secretCipher ?? identitySecretCipher
  let savedPayload: string

  try {
    savedPayload = await readFile(input.saveFilePath, 'utf8')
  } catch (error: unknown) {
    const isMissingFile =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code: string }).code === 'ENOENT'

    if (!isMissingFile) {
      throw error
    }

    const defaultState = createDefaultRuntimeState(input.storyOutline)
    await persistState(input.saveFilePath, defaultState, cipher)

    return {
      state: defaultState,
      recoveryAction: 'created-default'
    }
  }

  let deserializedState: RuntimeState
  try {
    const rawJson = JSON.parse(savedPayload) as unknown
    const decrypted = decryptApiKeyOnRawJson(rawJson, cipher)
    deserializedState = deserializeRuntimeState(JSON.stringify(decrypted))
  } catch {
    const defaultState = createDefaultRuntimeState(input.storyOutline)
    await persistState(input.saveFilePath, defaultState, cipher)

    return {
      state: defaultState,
      recoveryAction: 'reset-corrupted'
    }
  }

  const state = resolveRuntimeStateAgainstStoryOutline(deserializedState, input.storyOutline)

  return {
    state,
    recoveryAction: 'loaded-existing'
  }
}
