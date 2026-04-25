import { access, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, join } from 'node:path'
import { runDialogueSmokeTest } from '../src/modeling/dialogueSmokeTest.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from '../src/modeling/runtimeBootstrap.js'
import { buildLogStamp, ensureLogDir } from './logPaths.js'

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await access(filePath, constants.F_OK)
        return true
    } catch {
        return false
    }
}

const resolveModelPath = (input: RuntimeBootstrapInput): { profileId: string; modelPath: string } => {
    const bootstrap = buildRuntimeBootstrapPlan(input)
    return {
        profileId: bootstrap.selectedProfile.id,
        modelPath: join(
            bootstrap.storage.modelsDir,
            bootstrap.selectedProfile.id,
            basename(bootstrap.selectedProfile.files[0] ?? '')
        )
    }
}

const buildCandidateInputs = (projectRoot: string, appDataDir: string): RuntimeBootstrapInput[] => {
    // 允许通过环境变量 KUNLUN_SMOKE_MODE=compatibility 强制优先使用 3B fallback 方案，
    // 便于在同一机器上对 7B 与 3B 做对照 smoke。
    const forcedMode = process.env['KUNLUN_SMOKE_MODE']
    const preferredModes: Array<'default' | 'compatibility'> =
        forcedMode === 'compatibility'
            ? ['compatibility', 'default']
            : ['default', 'compatibility']

    const inputs: RuntimeBootstrapInput[] = []
    for (const isPackaged of [false, true]) {
        for (const preferredMode of preferredModes) {
            inputs.push({
                preferredMode,
                availableGpuVramGb: null,
                isPackaged,
                projectRoot,
                appDataDir
            })
        }
    }
    return inputs
}

const resolveExecutableSmokeInput = async (projectRoot: string, appDataDir: string): Promise<RuntimeBootstrapInput> => {
    const searchedPaths: string[] = []

    for (const input of buildCandidateInputs(projectRoot, appDataDir)) {
        const resolvedModel = resolveModelPath(input)
        searchedPaths.push(resolvedModel.modelPath)

        if (await fileExists(resolvedModel.modelPath)) {
            return input
        }
    }

    throw new Error(
        [
            'No local GGUF model file was found for dialogue smoke.',
            'Searched paths:',
            ...searchedPaths.map((path) => `- ${path}`),
            'Run `pnpm models:download` first, or place a compatible GGUF file in one of the searched locations.'
        ].join('\n')
    )
}

const main = async (): Promise<void> => {
    const projectRoot = process.cwd()
    const appDataDir = process.env['APPDATA']
        ? join(process.env['APPDATA'], 'Kunlungame')
        : join(projectRoot, 'runtime-cache')

    const input = await resolveExecutableSmokeInput(projectRoot, appDataDir)
    const result = await runDialogueSmokeTest(input)
    const logDir = await ensureLogDir(projectRoot, 'dialogue-smoke')
    const stamp = buildLogStamp()
    const logFile = join(logDir, `dialogue-smoke-${stamp}.json`)
    await writeFile(logFile, JSON.stringify(result, null, 2), 'utf8')
    console.log(`[smoke] log written to: ${logFile}`)
    console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})