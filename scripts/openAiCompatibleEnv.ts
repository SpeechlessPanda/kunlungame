import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface OpenAiCompatibleScriptSettings {
    apiKey: string
    baseUrl: string
    model: string
    fallbackModels: string[]
}

type EnvSource = Record<string, string | undefined>

const readLocalEnvFile = async (projectRoot: string): Promise<Record<string, string>> => {
    const localEnv: Record<string, string> = {}
    try {
        const raw = await readFile(join(projectRoot, '.env.local'), 'utf8')
        for (const line of raw.split(/\r?\n/u)) {
            const trimmed = line.trim()
            if (trimmed.length === 0 || trimmed.startsWith('#')) continue
            const separatorIndex = trimmed.indexOf('=')
            if (separatorIndex <= 0) continue
            const key = trimmed.slice(0, separatorIndex).trim()
            const value = trimmed.slice(separatorIndex + 1).trim().replace(/^(["'])(.*)\1$/u, '$2')
            if (key.length > 0) localEnv[key] = value
        }
    } catch {
        return {}
    }
    return localEnv
}

const parseFallbackModels = (raw: string): string[] => raw
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const assertOpenAiCompatibleRoot = (baseUrl: string): void => {
    if (/\/chat\/completions\/?$/u.test(baseUrl)) {
        throw new Error([
            'Base URL must be the OpenAI-compatible API root, not the full chat completions endpoint.',
            'Use for example: https://api.openai.com/v1 or https://openrouter.ai/api/v1'
        ].join(' '))
    }
}

export const loadOpenAiCompatibleEnv = async (
    projectRoot: string,
    env: EnvSource = process.env
): Promise<OpenAiCompatibleScriptSettings | null> => {
    const localEnv = await readLocalEnvFile(projectRoot)
    const readEnv = (name: string): string => (env[name] ?? localEnv[name] ?? '').trim()

    const apiKey = readEnv('KUNLUN_OPENAI_API_KEY') || readEnv('OPENAI_API_KEY')
    if (apiKey.length === 0) return null

    const baseUrl = readEnv('KUNLUN_OPENAI_BASE_URL') || readEnv('OPENAI_BASE_URL') || 'https://api.openai.com/v1'
    assertOpenAiCompatibleRoot(baseUrl)

    return {
        apiKey,
        baseUrl,
        model: readEnv('KUNLUN_OPENAI_MODEL') || readEnv('OPENAI_MODEL') || 'gpt-4o-mini',
        fallbackModels: parseFallbackModels(readEnv('KUNLUN_OPENAI_FALLBACK_MODELS') || readEnv('OPENAI_FALLBACK_MODELS'))
    }
}