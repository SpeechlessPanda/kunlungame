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
  /** 透传到 storyPromptBuilder；在 3B 等弱上下文模型上启用严格覆盖。 */
  strictCoverage?: boolean
}

export interface DialogueDependencies {
  streamText: (prompt: ReturnType<typeof buildStoryPrompt>) => AsyncIterable<DialogueTextStreamItem>
  generateOptions: (input: {
    currentNode: StoryNode
    semantics: PlayerAttitudeChoice[]
  }) => Promise<DialogueOption[]>
}

export async function* orchestrateDialogue(
  dependencies: DialogueDependencies,
  input: DialogueOrchestratorInput
): AsyncGenerator<DialogueEvent> {
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
  } catch (error: unknown) {
    yield {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown dialogue orchestration error.',
      retryable: true
    }
  }
}