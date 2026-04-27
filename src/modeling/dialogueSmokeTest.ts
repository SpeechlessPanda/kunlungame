import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { mainlineStoryOutline } from '../content/source/mainlineOutline.js'
import { createLocalDialogueDependencies } from './localDialogueDependencies.js'
import { retrieveKnowledgeEntries } from './knowledgeCompilation.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from './runtimeBootstrap.js'
import { getProModelProfile } from './modelProfiles.js'
import { knowledgeEntrySchema } from '../shared/contracts/contentContracts.js'
import { createDefaultRuntimeState } from '../runtime/runtimeState.js'
import { orchestrateDialogue, type DialogueDependencies, type DialogueOption } from './dialogueOrchestrator.js'
import { buildGalgameOptionLabels } from './optionLabels.js'
import { sanitizeMainlineReply } from './replyCleanup.js'
import { collectForbiddenProperNouns } from './storyPromptBuilder.js'
import { assessReplyQuality, buildCoverageRepairPrompt } from './replyQuality.js'

export interface DialogueSmokeTestResult {
    selectedProfileId: string
    currentNodeId: string
    fallbackUsed: boolean
    chunkCount: number
    combinedText: string
    combinedTextLength: number
    options: DialogueOption[]
    completed: boolean
    /** 墙钟耗时（毫秒），从构造 DialogueDependencies 到 complete 事件。*/
    elapsedMs: number
    /** 首个 chunk 的墙钟到达时间（毫秒，相对 elapsedMs 的起点）；用于衡量感知延迟。 */
    firstChunkMs: number | null
    /** 是否启用了严格覆盖模式（3B fallback 打开）。 */
    strictCoverage: boolean
}

export interface DialogueSmokeTestDependencies {
    readKnowledgeEntries: (knowledgeEntriesFile: string) => Promise<z.infer<typeof knowledgeEntrySchema>[]>
    createDialogueDependencies: (input: { modelPath: string }) => DialogueDependencies
}

const defaultDependencies: DialogueSmokeTestDependencies = {
    readKnowledgeEntries: async (knowledgeEntriesFile) => {
        const raw = await readFile(knowledgeEntriesFile, 'utf8')
        return z.array(knowledgeEntrySchema).parse(JSON.parse(raw))
    },
    createDialogueDependencies: ({ modelPath }) => createLocalDialogueDependencies({
        modelPath,
        maxRetries: 1,
        generateOptions: async () => buildGalgameOptionLabels({ turnIndex: 0 })
    })
}

const resolveKnowledgeEntriesFile = (projectRoot: string): string => {
    return join(projectRoot, 'src', 'content', 'generated', 'knowledgeEntries.json')
}

const resolveSelectedModelPath = (input: RuntimeBootstrapInput): { profileId: string; modelPath: string } => {
    const bootstrapPlan = buildRuntimeBootstrapPlan(input)
    return {
        profileId: bootstrapPlan.selectedProfile.id,
        modelPath: join(
            bootstrapPlan.storage.modelsDir,
            bootstrapPlan.selectedProfile.id,
            basename(bootstrapPlan.selectedProfile.files[0] ?? '')
        )
    }
}

export const runDialogueSmokeTest = async (
    input: RuntimeBootstrapInput,
    dependencies: Partial<DialogueSmokeTestDependencies> = {}
): Promise<DialogueSmokeTestResult> => {
    const resolvedDependencies = {
        ...defaultDependencies,
        ...dependencies
    }

    const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
    const currentNode = mainlineStoryOutline.nodes.find((node) => node.id === runtimeState.currentNodeId)
    if (currentNode == null) {
        throw new Error(`Current smoke-test node '${runtimeState.currentNodeId}' is not present in the mainline outline.`)
    }

    const knowledgeEntries = await resolvedDependencies.readKnowledgeEntries(resolveKnowledgeEntriesFile(input.projectRoot))
    const retrievalResult = retrieveKnowledgeEntries({
        entries: knowledgeEntries,
        currentNodeId: currentNode.id,
        allowedTopics: currentNode.allowedKnowledgeTopics,
        theme: currentNode.theme,
        keywords: currentNode.retrievalKeywords,
        limit: 3
    })

    const selectedModel = resolveSelectedModelPath(input)
    const strictCoverage = selectedModel.profileId !== getProModelProfile().id
    const dialogueDependencies = resolvedDependencies.createDialogueDependencies({
        modelPath: selectedModel.modelPath
    })

    const chunks: string[] = []
    let options: DialogueOption[] = []
    let completed = false
    const startMs = Date.now()
    let firstChunkMs: number | null = null

    for await (const event of orchestrateDialogue(dialogueDependencies, {
        currentNode,
        retrievedEntries: retrievalResult.entries,
        runtimeState,
        attitudeChoiceMode: 'align',
        recentTurns: [],
        strictCoverage
    })) {
        if (event.type === 'chunk') {
            if (firstChunkMs === null) {
                firstChunkMs = Date.now() - startMs
            }
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

        if (event.type === 'reset') {
            chunks.splice(0, chunks.length)
            continue
        }

        throw new Error(event.message)
    }

    const elapsedMs = Date.now() - startMs
    const forbiddenTerms = collectForbiddenProperNouns(currentNode)
    let combinedText = sanitizeMainlineReply(chunks.join(''), {
        forbiddenTerms
    })
    let finalChunkCount = chunks.length
    const quality = assessReplyQuality({ text: combinedText, currentNode })
    if (quality.needsRepair) {
        const repairPrompt = buildCoverageRepairPrompt({
            currentNode,
            retrievedEntries: retrievalResult.entries,
            previousText: combinedText,
            forbiddenTerms,
            reasons: quality.reasons
        })
        const repairChunks: string[] = []
        for await (const item of dialogueDependencies.streamText(repairPrompt)) {
            if (typeof item === 'string') repairChunks.push(item)
        }
        const repairText = sanitizeMainlineReply(repairChunks.join(''), { forbiddenTerms })
        const repairQuality = assessReplyQuality({ text: repairText, currentNode })
        if (repairText.length > combinedText.length && repairQuality.reasons.length <= quality.reasons.length) {
            combinedText = repairText
            finalChunkCount = repairChunks.length
        }
    }

    return {
        selectedProfileId: selectedModel.profileId,
        currentNodeId: currentNode.id,
        fallbackUsed: retrievalResult.fallbackUsed,
        chunkCount: finalChunkCount,
        combinedText,
        combinedTextLength: combinedText.length,
        options,
        completed,
        elapsedMs,
        firstChunkMs,
        strictCoverage
    }
}