import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, join } from 'node:path'
import { runDialogueSmokeTest } from '../src/modeling/dialogueSmokeTest.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from '../src/modeling/runtimeBootstrap.js'

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
    return [
        {
            preferredMode: 'default',
            availableGpuVramGb: null,
            isPackaged: false,
            projectRoot,
            appDataDir
        },
        {
            preferredMode: 'compatibility',
            availableGpuVramGb: null,
            isPackaged: false,
            projectRoot,
            appDataDir
        },
        {
            preferredMode: 'default',
            availableGpuVramGb: null,
            isPackaged: true,
            projectRoot,
            appDataDir
        },
        {
            preferredMode: 'compatibility',
            availableGpuVramGb: null,
            isPackaged: true,
            projectRoot,
            appDataDir
        }
    ]
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
    console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})