import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import { mainlineStoryOutline } from '../content/source/mainlineOutline.js'
import { createLocalDialogueDependencies } from './localDialogueDependencies.js'
import { retrieveKnowledgeEntries } from './knowledgeCompilation.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from './runtimeBootstrap.js'
import { knowledgeEntrySchema } from '../shared/contracts/contentContracts.js'
import { createDefaultRuntimeState } from '../runtime/runtimeState.js'
import { orchestrateDialogue, type DialogueDependencies, type DialogueOption } from './dialogueOrchestrator.js'
import { buildGalgameOptionLabels } from './optionLabels.js'

export interface DialogueSmokeTestResult {
    selectedProfileId: string
    currentNodeId: string
    fallbackUsed: boolean
    chunkCount: number
    combinedText: string
    options: DialogueOption[]
    completed: boolean
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
    const dialogueDependencies = resolvedDependencies.createDialogueDependencies({
        modelPath: selectedModel.modelPath
    })

    const chunks: string[] = []
    let options: DialogueOption[] = []
    let completed = false

    for await (const event of orchestrateDialogue(dialogueDependencies, {
        currentNode,
        retrievedEntries: retrievalResult.entries,
        runtimeState,
        attitudeChoiceMode: 'align',
        recentTurns: []
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

        throw new Error(event.message)
    }

    return {
        selectedProfileId: selectedModel.profileId,
        currentNodeId: currentNode.id,
        fallbackUsed: retrievalResult.fallbackUsed,
        chunkCount: chunks.length,
        combinedText: chunks.join(''),
        options,
        completed
    }
}