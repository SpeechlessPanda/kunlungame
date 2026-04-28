import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { runMainlineTurn } from '../src/modeling/mainlineTurnRunner.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import { buildLogStamp, ensureLogDir } from './logPaths.js'

const localEnv: Record<string, string> = {}

const loadLocalEnv = async (projectRoot: string): Promise<void> => {
  try {
    const raw = await readFile(join(projectRoot, '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/u)) {
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^(["'])(.*)\1$/u, '$2')
      if (key.length > 0 && process.env[key] == null) localEnv[key] = value
    }
  } catch {
    // .env.local is optional; environment variables remain the primary path.
  }
}

const readEnv = (name: string): string => (process.env[name] ?? localEnv[name] ?? '').trim()

const readApiKey = (): string => readEnv('KUNLUN_OPENAI_API_KEY') || readEnv('OPENAI_API_KEY')

const readFallbackModels = (): string[] => {
  const raw = readEnv('KUNLUN_OPENAI_FALLBACK_MODELS') || readEnv('OPENAI_FALLBACK_MODELS')
  return raw
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const resolveBaseUrl = (): string => readEnv('KUNLUN_OPENAI_BASE_URL') || readEnv('OPENAI_BASE_URL') || 'https://api.openai.com/v1'

const assertOpenAiCompatibleRoot = (baseUrl: string): void => {
  if (/\/chat\/completions\/?$/u.test(baseUrl)) {
    throw new Error([
      'Base URL must be the OpenAI-compatible API root, not the full chat completions endpoint.',
      'Use for example: https://api.openai.com/v1 or https://openrouter.ai/api/v1'
    ].join(' '))
  }
}

const main = async (): Promise<void> => {
  const projectRoot = process.cwd()
  await loadLocalEnv(projectRoot)
  const apiKey = readApiKey()
  if (apiKey.length === 0) {
    throw new Error('Set KUNLUN_OPENAI_API_KEY or OPENAI_API_KEY before running `pnpm smoke:openai`.')
  }

  const baseUrl = resolveBaseUrl()
  assertOpenAiCompatibleRoot(baseUrl)
  const model = readEnv('KUNLUN_OPENAI_MODEL') || readEnv('OPENAI_MODEL') || 'gpt-4o-mini'
  const appDataDir = process.env['APPDATA']
    ? join(process.env['APPDATA'], 'Kunlungame')
    : join(projectRoot, 'runtime-cache')

  const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
  const result = await runMainlineTurn({
    preferredMode: 'default',
    availableGpuVramGb: null,
    isPackaged: false,
    projectRoot,
    appDataDir,
    nodeId: runtimeState.currentNodeId,
    attitudeChoiceMode: 'align',
    runtimeState: {
      ...runtimeState,
      settings: {
        ...runtimeState.settings,
        modelProvider: 'openai-compatible',
        openAiCompatible: {
          apiKey,
          baseUrl,
          model,
          fallbackModels: readFallbackModels()
        }
      }
    },
    recentTurns: []
  })

  const logDir = await ensureLogDir(projectRoot, 'dialogue-smoke')
  const stamp = buildLogStamp()
  const logFile = join(logDir, `openai-compatible-smoke-${stamp}.json`)
  const safeResult = {
    createdAt: new Date().toISOString(),
    provider: 'openai-compatible',
    baseUrl,
    model,
    result
  }
  await writeFile(logFile, JSON.stringify(safeResult, null, 2), 'utf8')

  if (result.ok === false) {
    console.error(`[openai-smoke] failed: ${result.reason} - ${result.message}`)
    console.error(`[openai-smoke] log written to: ${logFile}`)
    process.exitCode = 1
    return
  }

  console.log(`[openai-smoke] model=${model} baseUrl=${baseUrl}`)
  console.log(`[openai-smoke] chars=${result.combinedText.length} chunks=${result.chunks.length}`)
  console.log(`[openai-smoke] options=${result.options.map((option) => `[${option.semantic}] ${option.label}`).join(' | ')}`)
  console.log('[openai-smoke] dialogue:')
  console.log(result.combinedText)
  console.log(`[openai-smoke] log written to: ${logFile}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})