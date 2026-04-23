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
    createSession?: (modelPath: string, systemPrompt?: string) => Promise<LocalLlamaSession>
}

/**
 * 调试用：以人可读的 "System:/User:" 两段拼成一个完整请求快照。
 * 注意：运行时不再使用这种拼接向 LLM 提诮——system 会通过
 * `LlamaChatSession.systemPrompt` 走原生 ChatML 模板，user 部分才是 session.prompt() 的实参。
 */
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
        const session = await createSession(input.modelPath, input.prompt.system)
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
            // 只传用户侧 prompt；systemPrompt 已经在 createSession 时被绑到 ChatML 的 system 角色。
            .prompt(input.prompt.user, {
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