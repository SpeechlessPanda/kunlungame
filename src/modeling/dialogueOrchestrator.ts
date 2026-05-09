import type { KnowledgeEntry, StoryNode } from '../shared/contracts/contentContracts.js'
import type { RuntimeState, PlayerAttitudeChoice } from '../runtime/runtimeState.js'
import { buildStoryPrompt } from './storyPromptBuilder.js'

export interface DialogueOption {
  semantic: PlayerAttitudeChoice
  label: string
}

export type DialogueTextStreamItem = string | { type: 'reset' }

export type DialogueEvent =
  | { type: 'chunk'; text: string }
  | { type: 'reset' }
  | { type: 'options'; options: DialogueOption[] }
  | { type: 'complete' }
  | { type: 'error'; message: string; retryable: boolean }

export interface DialogueOrchestratorInput {
  currentNode: StoryNode
  retrievedEntries: KnowledgeEntry[]
  runtimeState: RuntimeState
  attitudeChoiceMode: PlayerAttitudeChoice
  recentTurns: string[]
}

export interface DialogueDependencies {
  streamText: (prompt: ReturnType<typeof buildStoryPrompt>) => AsyncIterable<DialogueTextStreamItem>
  generateOptions: (input: {
    currentNode: StoryNode
    semantics: PlayerAttitudeChoice[]
  }) => Promise<DialogueOption[]>
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function* orchestrateDialogue(
  dependencies: DialogueDependencies,
  input: DialogueOrchestratorInput
): AsyncGenerator<DialogueEvent> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const prompt = buildStoryPrompt(input)

      for await (const item of dependencies.streamText(prompt)) {
        if (typeof item !== 'string') {
          yield { type: 'reset' }
          continue
        }
        yield {
          type: 'chunk',
          text: item
        }
      }

      const options = await dependencies.generateOptions({
        currentNode: input.currentNode,
        semantics: ['align', 'challenge']
      })

      yield {
        type: 'options',
        options
      }

      yield {
        type: 'complete'
      }
      return
    } catch (error: unknown) {
      const isTermination = error instanceof Error && (
        error.message.includes('terminated') ||
        error.message.includes('timed out') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('socket')
      )
      if (attempt < MAX_RETRIES && isTermination) {
        yield {
          type: 'reset'
        }
        await delay(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown dialogue orchestration error.',
        retryable: true
      }
      return
    }
  }
}