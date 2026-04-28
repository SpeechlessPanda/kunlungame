import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { runMainlineTurn } from '../src/modeling/mainlineTurnRunner.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'
import { buildLogStamp, ensureLogDir } from './logPaths.js'
import { loadOpenAiCompatibleEnv } from './openAiCompatibleEnv.js'

const main = async (): Promise<void> => {
  const projectRoot = process.cwd()
  const settings = await loadOpenAiCompatibleEnv(projectRoot)
  if (settings == null) {
    throw new Error('Set KUNLUN_OPENAI_API_KEY or OPENAI_API_KEY before running `pnpm smoke:openai`.')
  }
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
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
          fallbackModels: settings.fallbackModels
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
    baseUrl: settings.baseUrl,
    model: settings.model,
    result
  }
  await writeFile(logFile, JSON.stringify(safeResult, null, 2), 'utf8')

  if (result.ok === false) {
    console.error(`[openai-smoke] failed: ${result.reason} - ${result.message}`)
    console.error(`[openai-smoke] log written to: ${logFile}`)
    process.exitCode = 1
    return
  }

  console.log(`[openai-smoke] model=${settings.model} baseUrl=${settings.baseUrl}`)
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