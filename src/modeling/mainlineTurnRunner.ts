import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { mainlineStoryOutline } from '../content/source/mainlineOutline.js'
import { retrieveKnowledgeEntries } from './knowledgeCompilation.js'
import { createOpenAiCompatibleDialogueDependencies } from './openAiCompatibleDialogueDependencies.js'
import { knowledgeEntrySchema } from '../shared/contracts/contentContracts.js'
import {
  orchestrateDialogue,
  type DialogueDependencies,
  type DialogueOption
} from './dialogueOrchestrator.js'
import type { RuntimeState } from '../runtime/runtimeState.js'
import { buildGalgameOptionLabels } from './optionLabels.js'
import { sanitizeMainlineReply } from './replyCleanup.js'

export type MainlineAttitudeChoice = 'align' | 'challenge'

export interface MainlineTurnInput {
  projectRoot: string
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
  currentNodeId: string
  chunks: string[]
  combinedText: string
  options: DialogueOption[]
  completed: boolean
}

export type MainlineTurnFailure = {
  ok: false
  reason: 'node-missing' | 'api-missing' | 'orchestration-failed'
  message: string
}

export type MainlineTurnResult = MainlineTurnSuccess | MainlineTurnFailure

export interface MainlineTurnDependencies {
  readKnowledgeEntries: (file: string) => Promise<z.infer<typeof knowledgeEntrySchema>[]>
  createDialogueDependencies: (input: {
    openAiCompatible: RuntimeState['settings']['openAiCompatible']
    turnIndex: number
    isEnding: boolean
    nodeId?: string
  }) => DialogueDependencies
}

const knowledgeEntriesCache = new Map<string, z.infer<typeof knowledgeEntrySchema>[]>()

const defaultReadKnowledgeEntries: MainlineTurnDependencies['readKnowledgeEntries'] = async (file) => {
  const cached = knowledgeEntriesCache.get(file)
  if (cached != null) return cached
  const raw = await readFile(file, 'utf8')
  const parsed = z.array(knowledgeEntrySchema).parse(JSON.parse(raw))
  knowledgeEntriesCache.set(file, parsed)
  return parsed
}

const defaultCreateDialogueDependencies: MainlineTurnDependencies['createDialogueDependencies'] = ({
  openAiCompatible,
  turnIndex,
  isEnding,
  nodeId
}) => {
  const generateOptions = async () => buildGalgameOptionLabels({ turnIndex, isEnding, nodeId })
  return createOpenAiCompatibleDialogueDependencies({
    apiKey: openAiCompatible.apiKey,
    baseUrl: openAiCompatible.baseUrl,
    model: openAiCompatible.model,
    fallbackModels: openAiCompatible.fallbackModels,
    generateOptions
  })
}

const defaultDependencies: MainlineTurnDependencies = {
  readKnowledgeEntries: defaultReadKnowledgeEntries,
  createDialogueDependencies: defaultCreateDialogueDependencies
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

  const openAiCompatible = input.runtimeState.settings.openAiCompatible
  if (openAiCompatible.apiKey.trim().length === 0 || openAiCompatible.model.trim().length === 0) {
    return {
      ok: false,
      reason: 'api-missing',
      message: '请在设置中填写 API Key 和模型名称。'
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
      openAiCompatible,
      turnIndex: input.runtimeState.turnIndex,
      isEnding: input.runtimeState.isCompleted || currentNode.nextNodeId === null,
      nodeId: currentNode.id
    })
  } catch (error) {
    return {
      ok: false,
      reason: 'orchestration-failed',
      message: error instanceof Error ? error.message : String(error)
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
        stream.onChunk?.(event.text)
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
        stream.onReset?.()
        continue
      }
      return {
        ok: false,
        reason: 'orchestration-failed',
        message: event.message
      }
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'orchestration-failed',
      message: error instanceof Error ? error.message : String(error)
    }
  }

  const rawCombined = chunks.join('')
  const combinedText = sanitizeMainlineReply(rawCombined)
  const cleanedChunks = combinedText === rawCombined ? chunks : splitCleanedReplyIntoChunks(combinedText)

  return {
    ok: true,
    currentNodeId: currentNode.id,
    chunks: cleanedChunks,
    combinedText,
    options,
    completed
  }
}
