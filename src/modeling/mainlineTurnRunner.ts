import { access } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { mainlineStoryOutline } from '../content/source/mainlineOutline.js'
import { retrieveKnowledgeEntries } from './knowledgeCompilation.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from './runtimeBootstrap.js'
import { createLocalDialogueDependencies } from './localDialogueDependencies.js'
import { createOpenAiCompatibleDialogueDependencies } from './openAiCompatibleDialogueDependencies.js'
import { knowledgeEntrySchema } from '../shared/contracts/contentContracts.js'
import {
    orchestrateDialogue,
    type DialogueDependencies,
    type DialogueOption
} from './dialogueOrchestrator.js'
import type { RuntimeState } from '../runtime/runtimeState.js'
import { buildGalgameOptionLabels } from './optionLabels.js'
import { getProModelProfile } from './modelProfiles.js'
import { sanitizeMainlineReply } from './replyCleanup.js'
import { collectForbiddenProperNouns } from './storyPromptBuilder.js'
import { assessReplyQuality, buildCoverageRepairPrompt } from './replyQuality.js'

/**
 * Part 08 · 真实本地模型主线回合执行器。
 *
 * `runMainlineTurn` 是 `runDialogueSmokeTest` 的一般化版本：不再写死节点和默认状态，
 * 而是接受渲染层传入的当前节点 id、运行时状态、态度倾向与最近摘要，
 * 在主进程里用真正的 `localDialogueDependencies` 把一轮对话跑完。
 * Electron 桌面桥会通过可选 stream callbacks 把正在生成的 chunk 实时送到渲染层；
 * 函数最终仍返回完整结果，供选项、存档摘要和兼容回退链路使用。
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

export interface MainlineTurnStreamCallbacks {
    onChunk?: (text: string) => void
    onReset?: () => void
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
        provider: 'local' | 'openai-compatible'
        modelPath: string
        openAiCompatible?: RuntimeState['settings']['openAiCompatible']
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

const defaultCreateDialogueDependencies: MainlineTurnDependencies['createDialogueDependencies'] = ({
    provider,
    modelPath,
    openAiCompatible,
    turnIndex,
    isEnding
}) => {
    const generateOptions = async () => buildGalgameOptionLabels({ turnIndex, isEnding })
    if (provider === 'openai-compatible' && openAiCompatible != null) {
        return createOpenAiCompatibleDialogueDependencies({
            apiKey: openAiCompatible.apiKey,
            baseUrl: openAiCompatible.baseUrl,
            model: openAiCompatible.model,
            fallbackModels: openAiCompatible.fallbackModels,
            generateOptions
        })
    }
    return createLocalDialogueDependencies({
        modelPath,
        maxRetries: 1,
        generateOptions
    })
}

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

type ResolvedModelTarget =
    | { provider: 'local'; profileId: string; modelPath: string }
    | {
        provider: 'openai-compatible'
        profileId: 'openai-compatible'
        modelPath: string
        openAiCompatible: RuntimeState['settings']['openAiCompatible']
    }

const shouldUseOpenAiCompatible = (settings: RuntimeState['settings']): boolean => {
    return settings.modelProvider === 'openai-compatible' &&
        settings.openAiCompatible.apiKey.trim().length > 0 &&
        settings.openAiCompatible.model.trim().length > 0
}

const resolveModelTarget = (input: MainlineTurnInput): ResolvedModelTarget => {
    if (shouldUseOpenAiCompatible(input.runtimeState.settings)) {
        return {
            provider: 'openai-compatible',
            profileId: 'openai-compatible',
            modelPath: `openai-compatible:${input.runtimeState.settings.openAiCompatible.model}`,
            openAiCompatible: input.runtimeState.settings.openAiCompatible
        }
    }

    return {
        provider: 'local',
        ...resolveModelPath(input)
    }
}

const resolveKnowledgeEntriesFile = (projectRoot: string): string => {
    return join(projectRoot, 'src', 'content', 'generated', 'knowledgeEntries.json')
}

const splitCleanedReplyIntoChunks = (text: string): string[] => {
    const chunks = text.match(/[^。！？?!\n]+[。！？?!]?|\n+/gu) ?? []
    return chunks
        .map((chunk) => chunk.trimEnd())
        .filter((chunk) => chunk.trim().length > 0)
}

const createSafeChunkEmitter = (input: {
    forbiddenTerms: string[]
    recentTurns: string[]
    onChunk?: (text: string) => void
}) => {
    let pending = ''
    const maxBufferedChars = 8

    const takePrefix = (text: string, count: number): string => Array.from(text).slice(0, count).join('')

    const emitCleaned = (text: string): void => {
        const cleaned = sanitizeMainlineReply(text, {
            recentTurns: input.recentTurns,
            forbiddenTerms: input.forbiddenTerms
        })
        if (cleaned.length > 0) input.onChunk?.(cleaned)
    }

    const push = (text: string): void => {
        pending += text
        while (pending.length > 0) {
            const sentenceMatch = pending.match(/^[\s\S]*?[。！？?!\n]/u)
            const nextChunk = sentenceMatch?.[0]
                ?? (Array.from(pending).length >= maxBufferedChars ? takePrefix(pending, maxBufferedChars) : null)
            if (nextChunk == null) return
            emitCleaned(nextChunk)
            pending = pending.slice(nextChunk.length)
        }
    }

    const flush = (): void => {
        if (pending.trim().length > 0) emitCleaned(pending)
        pending = ''
    }

    return { push, flush }
}

export const runMainlineTurn = async (
    input: MainlineTurnInput,
    overrides: Partial<MainlineTurnDependencies> = {},
    stream: MainlineTurnStreamCallbacks = {}
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

    const selectedModel = resolveModelTarget(input)
    const fileExists = selectedModel.provider === 'local'
        ? await deps.checkFileExists(selectedModel.modelPath)
        : true
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
        limit: input.retrievalLimit ?? 3,
        turnSalt: input.runtimeState.turnsInCurrentNode
    })

    let dialogueDependencies: DialogueDependencies
    try {
        dialogueDependencies = deps.createDialogueDependencies({
            provider: selectedModel.provider,
            modelPath: selectedModel.modelPath,
            ...(selectedModel.provider === 'openai-compatible'
                ? { openAiCompatible: selectedModel.openAiCompatible }
                : {}),
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
    const forbiddenTerms = collectForbiddenProperNouns(currentNode)
    const liveEmitter = createSafeChunkEmitter({
        forbiddenTerms,
        recentTurns: input.recentTurns,
        onChunk: stream.onChunk
    })

    try {
        for await (const event of orchestrateDialogue(dialogueDependencies, {
            currentNode,
            retrievedEntries: retrieval.entries,
            runtimeState: input.runtimeState,
            attitudeChoiceMode: input.attitudeChoiceMode,
            recentTurns: input.recentTurns,
            // 1.5B / 3B 都需要 strictCoverage（小模型指令遵循弱），只有 7B Pro 可以放宽。
            strictCoverage: selectedModel.provider === 'local' && selectedModel.profileId !== getProModelProfile().id
        })) {
            if (event.type === 'chunk') {
                chunks.push(event.text)
                liveEmitter.push(event.text)
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
            if (event.type === 'reset') {
                chunks.splice(0, chunks.length)
                liveEmitter.flush()
                stream.onReset?.()
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
    liveEmitter.flush()

    const rawCombined = chunks.join('')
    let combinedText = sanitizeMainlineReply(rawCombined, {
        recentTurns: input.recentTurns,
        forbiddenTerms
    })
    let cleanedChunks = combinedText === rawCombined ? chunks : splitCleanedReplyIntoChunks(combinedText)
    const quality = assessReplyQuality({ text: combinedText, currentNode })
    if (quality.needsRepair) {
        const repairPrompt = buildCoverageRepairPrompt({
            currentNode,
            retrievedEntries: retrieval.entries,
            previousText: combinedText,
            forbiddenTerms,
            reasons: quality.reasons
        })
        const repairEmitter = createSafeChunkEmitter({
            forbiddenTerms,
            recentTurns: input.recentTurns,
            onChunk: stream.onChunk
        })
        const repairRawChunks: string[] = []
        for await (const item of dialogueDependencies.streamText(repairPrompt)) {
            if (typeof item !== 'string') continue
            repairRawChunks.push(item)
        }
        const repairText = sanitizeMainlineReply(repairRawChunks.join(''), {
            recentTurns: input.recentTurns,
            forbiddenTerms
        })
        const repairQuality = assessReplyQuality({ text: repairText, currentNode })
        if (repairText.length > combinedText.length && repairQuality.reasons.length <= quality.reasons.length) {
            stream.onReset?.()
            for (const chunk of repairRawChunks) repairEmitter.push(chunk)
            repairEmitter.flush()
            combinedText = repairText
            cleanedChunks = splitCleanedReplyIntoChunks(repairText)
        }
    }

    return {
        ok: true,
        selectedProfileId: selectedModel.profileId,
        modelPath: selectedModel.modelPath,
        currentNodeId: currentNode.id,
        fallbackUsed: retrieval.fallbackUsed,
        chunks: cleanedChunks,
        combinedText,
        options,
        completed
    }
}
