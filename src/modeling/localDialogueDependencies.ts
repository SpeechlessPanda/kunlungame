import type { DialogueDependencies, DialogueOption } from './dialogueOrchestrator.js'
import type { StoryPrompt } from './storyPromptBuilder.js'
import { createRealLlamaSession } from './realLlamaSession.js'

export interface LocalLlamaPromptCallOptions {
    maxTokens?: number
    onTextChunk?: (text: string) => void
}

export interface LocalLlamaSession {
    prompt: (prompt: string, options: LocalLlamaPromptCallOptions) => Promise<string>
    dispose: () => Promise<void>
}

export interface LocalDialogueDependenciesInput {
    modelPath: string
    maxTokens?: number
    maxRetries?: number
    generateOptions: DialogueDependencies['generateOptions']
}

export interface StreamLocalLlamaTextInput {
    prompt: StoryPrompt
    modelPath: string
    maxTokens?: number
    maxRetries?: number
}

export interface LocalDialogueDependenciesOverrides {
    createSession?: (modelPath: string) => Promise<LocalLlamaSession>
}

export const formatStoryPrompt = (prompt: StoryPrompt): string => {
    return [
        'System:',
        prompt.system,
        '',
        'User:',
        prompt.user
    ].join('\n')
}

export async function* streamLocalLlamaText(
    input: StreamLocalLlamaTextInput,
    overrides: LocalDialogueDependenciesOverrides = {}
): AsyncGenerator<string> {
    const createSession = overrides.createSession ?? createRealLlamaSession
    const maxRetries = input.maxRetries ?? 0

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const session = await createSession(input.modelPath)
        const queuedChunks: string[] = []
        let didEmitAnyChunk = false
        let isSettled = false
        let settledError: unknown = null
        let wakeReader: (() => void) | null = null

        const notifyReader = () => {
            const resolver = wakeReader
            wakeReader = null
            resolver?.()
        }

        const waitForNextSignal = async () => {
            if (queuedChunks.length > 0 || isSettled) {
                return
            }

            await new Promise<void>((resolve) => {
                wakeReader = resolve
            })
        }

        const promptPromise = session
            .prompt(formatStoryPrompt(input.prompt), {
                maxTokens: input.maxTokens,
                onTextChunk: (text) => {
                    if (text.length === 0) {
                        return
                    }

                    didEmitAnyChunk = true
                    queuedChunks.push(text)
                    notifyReader()
                }
            })
            .catch((error: unknown) => {
                settledError = error
            })
            .finally(() => {
                isSettled = true
                notifyReader()
            })

        try {
            while (!isSettled || queuedChunks.length > 0) {
                await waitForNextSignal()

                while (queuedChunks.length > 0) {
                    const chunk = queuedChunks.shift()
                    if (chunk != null) {
                        yield chunk
                    }
                }
            }

            await promptPromise

            if (settledError == null) {
                return
            }

            if (!didEmitAnyChunk && attempt < maxRetries) {
                continue
            }

            throw settledError
        } finally {
            await session.dispose()
        }
    }
}

export const createLocalDialogueDependencies = (
    input: LocalDialogueDependenciesInput,
    overrides: LocalDialogueDependenciesOverrides = {}
): DialogueDependencies => {
    return {
        streamText: (prompt) => streamLocalLlamaText(
            {
                prompt,
                modelPath: input.modelPath,
                maxTokens: input.maxTokens,
                maxRetries: input.maxRetries
            },
            overrides
        ),
        generateOptions: async (optionsInput): Promise<DialogueOption[]> => input.generateOptions(optionsInput)
    }
}