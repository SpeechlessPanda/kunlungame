import type { LocalLlamaSession } from './localDialogueDependencies.js'

/**
 * 真实 node-llama-cpp 会话加载路径。该函数直接 `import('node-llama-cpp')` 并
 * 装载 GGUF 模型到内存，在单元测试里无法被覆盖（需要真实模型文件 + 本机 llama 运行时）。
 * 因此把这段纯装配代码隔离到独立模块，`vitest.config.ts` 在覆盖率里排除它，
 * 其余可以白盒测试的流式拼装/重试逻辑仍然保留在 localDialogueDependencies.ts。
 *
 * 运行时由 `createLocalDialogueDependencies({ createSession: createRealLlamaSession })`
 * 注入；`dialogueSmokeTest` / `mainlineTurnRunner` 已经在使用本函数。
 */
export const createRealLlamaSession = async (
    modelPath: string,
    systemPrompt?: string
): Promise<LocalLlamaSession> => {
    const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
    const llama = await getLlama({ gpu: false })
    const model = await llama.loadModel({ modelPath })
    // 8192 token 对当前 prompt（人格 + 检索条目 + 近 5 轮）是个舒服的底线，
    // 2048 会被Qwen2.5按 token 序列错位裁掉系统 prompt。
    const context = await model.createContext({ contextSize: { max: 8192 } })
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        // 关键修正：走 ChatML <|im_start|>system... 模板，避免人格被当成普通用户文本骑丢。
        ...(systemPrompt != null && systemPrompt.length > 0 ? { systemPrompt } : {})
    })

    return {
        prompt: async (prompt, options) => {
            return await session.prompt(prompt, {
                maxTokens: options.maxTokens ?? 512,
                onTextChunk: options.onTextChunk,
                stopOnAbortSignal: true,
                temperature: 0.88,
                topP: 0.92,
                // 压低「你是不是觉得这有点儿神奇」这类句式被反复拼贴的概率，
                // 也减少轮与轮之间模型拿上一轮输出原句复诵；lastTokens 覆盖整段回答，
                // 避免 3B 在一条回复里反复排列同一组神话名词。
                repeatPenalty: {
                    penalty: 1.18,
                    lastTokens: 512,
                    frequencyPenalty: 0.45,
                    presencePenalty: 0.45
                }
            })
        },
        dispose: async () => {
            await session.dispose?.()
            await context.dispose?.()
            await model.dispose?.()
            await llama.dispose?.()
        }
    }
}
