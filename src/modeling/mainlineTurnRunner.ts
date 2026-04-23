import { access } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { mainlineStoryOutline } from '../content/source/mainlineOutline.js'
import { retrieveKnowledgeEntries } from './knowledgeCompilation.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from './runtimeBootstrap.js'
import { createLocalDialogueDependencies } from './localDialogueDependencies.js'
import { knowledgeEntrySchema } from '../shared/contracts/contentContracts.js'
import {
    orchestrateDialogue,
    type DialogueDependencies,
    type DialogueOption
} from './dialogueOrchestrator.js'
import type { RuntimeState } from '../runtime/runtimeState.js'
import { buildGalgameOptionLabels } from './optionLabels.js'

/**
 * Part 08 · 真实本地模型主线回合执行器。
 *
 * `runMainlineTurn` 是 `runDialogueSmokeTest` 的一般化版本：不再写死节点和默认状态，
 * 而是接受渲染层传入的当前节点 id、运行时状态、态度倾向与最近摘要，
 * 在主进程里用真正的 `localDialogueDependencies` 把一轮对话跑完，
 * 然后把收集到的所有 chunk 和两个选项一次性交还给渲染层。
 *
 * 之所以一次性返回而不是流式，是因为当前 Electron IPC 桥只需要支持
 * 单次 invoke/reply；渲染层可以在收到 chunks 后自己再做逐字呈现。
 *
 * 如果模型文件不存在或加载失败，函数不会 throw，而是返回 `{ ok: false, reason }`，
 * 让 UI 可以清晰降级，不至于静默卡死。
 */

export type MainlineAttitudeChoice = 'align' | 'challenge'

export interface MainlineTurnInput extends RuntimeBootstrapInput {
    nodeId: string
    attitudeChoiceMode: MainlineAttitudeChoice
    runtimeState: RuntimeState
    recentTurns: string[]
    retrievalLimit?: number
}

export type MainlineTurnSuccess = {
    ok: true
    selectedProfileId: string
    modelPath: string
    currentNodeId: string
    fallbackUsed: boolean
    chunks: string[]
    combinedText: string
    options: DialogueOption[]
    completed: boolean
}

export type MainlineTurnFailure = {
    ok: false
    reason: 'node-missing' | 'model-missing' | 'model-load-failed' | 'orchestration-failed'
    message: string
    modelPath?: string
}

export type MainlineTurnResult = MainlineTurnSuccess | MainlineTurnFailure

export interface MainlineTurnDependencies {
    /** 读取已编译知识条目，默认从 `<projectRoot>/src/content/generated/knowledgeEntries.json` 读取。 */
    readKnowledgeEntries: (file: string) => Promise<z.infer<typeof knowledgeEntrySchema>[]>
    /** 检查模型文件是否存在；默认用 `fs.access`。*/
    checkFileExists: (path: string) => Promise<boolean>
    /** 构造真实 `DialogueDependencies`；默认调用 `createLocalDialogueDependencies`。可在测试里注入 mock 以避免加载 GGUF。 */
    createDialogueDependencies: (input: {
        modelPath: string
        /** 当前已经走到第几轮（用于轮换 option 文案，避免每轮选项长一样）。 */
        turnIndex: number
        /** 这一轮是否已是结局，结局的选项语义变成"再走一次 / 暂时离开"。 */
        isEnding: boolean
    }) => DialogueDependencies
}

const defaultReadKnowledgeEntries: MainlineTurnDependencies['readKnowledgeEntries'] = async (file) => {
    const raw = await readFile(file, 'utf8')
    return z.array(knowledgeEntrySchema).parse(JSON.parse(raw))
}

const defaultCheckFileExists: MainlineTurnDependencies['checkFileExists'] = async (path) => {
    try {
        await access(path)
        return true
    } catch {
        return false
    }
}

const defaultCreateDialogueDependencies: MainlineTurnDependencies['createDialogueDependencies'] = ({ modelPath, turnIndex, isEnding }) =>
    createLocalDialogueDependencies({
        modelPath,
        maxRetries: 1,
        generateOptions: async () => buildGalgameOptionLabels({ turnIndex, isEnding })
    })

const defaultDependencies: MainlineTurnDependencies = {
    readKnowledgeEntries: defaultReadKnowledgeEntries,
    checkFileExists: defaultCheckFileExists,
    createDialogueDependencies: defaultCreateDialogueDependencies
}

const resolveModelPath = (input: RuntimeBootstrapInput): { profileId: string; modelPath: string } => {
    const plan = buildRuntimeBootstrapPlan(input)
    const firstFile = plan.selectedProfile.files[0]
    if (firstFile == null) {
        throw new Error(`Selected profile '${plan.selectedProfile.id}' has no model file entries.`)
    }
    return {
        profileId: plan.selectedProfile.id,
        modelPath: join(plan.storage.modelsDir, plan.selectedProfile.id, basename(firstFile))
    }
}

const resolveKnowledgeEntriesFile = (projectRoot: string): string => {
    return join(projectRoot, 'src', 'content', 'generated', 'knowledgeEntries.json')
}

export const runMainlineTurn = async (
    input: MainlineTurnInput,
    overrides: Partial<MainlineTurnDependencies> = {}
): Promise<MainlineTurnResult> => {
    const deps: MainlineTurnDependencies = { ...defaultDependencies, ...overrides }

    const currentNode = mainlineStoryOutline.nodes.find((node) => node.id === input.nodeId)
    if (currentNode == null) {
        return {
            ok: false,
            reason: 'node-missing',
            message: `Node '${input.nodeId}' is not part of the canonical mainline outline.`
        }
    }

    const selectedModel = resolveModelPath(input)
    const fileExists = await deps.checkFileExists(selectedModel.modelPath)
    if (!fileExists) {
        return {
            ok: false,
            reason: 'model-missing',
            message: `Model file not found at '${selectedModel.modelPath}'. Run 'pnpm models:download' or drop the GGUF manually.`,
            modelPath: selectedModel.modelPath
        }
    }

    const entriesFile = resolveKnowledgeEntriesFile(input.projectRoot)
    const knowledgeEntries = await deps.readKnowledgeEntries(entriesFile)
    const retrieval = retrieveKnowledgeEntries({
        entries: knowledgeEntries,
        currentNodeId: currentNode.id,
        allowedTopics: currentNode.allowedKnowledgeTopics,
        theme: currentNode.theme,
        keywords: currentNode.retrievalKeywords,
        limit: input.retrievalLimit ?? 3
    })

    let dialogueDependencies: DialogueDependencies
    try {
        dialogueDependencies = deps.createDialogueDependencies({
            modelPath: selectedModel.modelPath,
            turnIndex: input.runtimeState.turnIndex,
            isEnding: input.runtimeState.isCompleted || currentNode.nextNodeId === null
        })
    } catch (error) {
        return {
            ok: false,
            reason: 'model-load-failed',
            message: error instanceof Error ? error.message : String(error),
            modelPath: selectedModel.modelPath
        }
    }

    const chunks: string[] = []
    let options: DialogueOption[] = []
    let completed = false

    try {
        for await (const event of orchestrateDialogue(dialogueDependencies, {
            currentNode,
            retrievedEntries: retrieval.entries,
            runtimeState: input.runtimeState,
            attitudeChoiceMode: input.attitudeChoiceMode,
            recentTurns: input.recentTurns
        })) {
            if (event.type === 'chunk') {
                chunks.push(event.text)
                continue
            }
            if (event.type === 'options') {
                options = event.options
                continue
            }
            if (event.type === 'complete') {
                completed = true
                continue
            }
            // event.type === 'error'
            return {
                ok: false,
                reason: 'orchestration-failed',
                message: event.message,
                modelPath: selectedModel.modelPath
            }
        }
    } catch (error) {
        return {
            ok: false,
            reason: 'orchestration-failed',
            message: error instanceof Error ? error.message : String(error),
            modelPath: selectedModel.modelPath
        }
    }

    return {
        ok: true,
        selectedProfileId: selectedModel.profileId,
        modelPath: selectedModel.modelPath,
        currentNodeId: currentNode.id,
        fallbackUsed: retrieval.fallbackUsed,
        chunks,
        combinedText: chunks.join(''),
        options,
        completed
    }
}
