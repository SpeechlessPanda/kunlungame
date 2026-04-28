import type { LocalLlamaSession } from './localDialogueDependencies.js'
import type { LlamaContextOptions, LlamaLogLevel, LlamaModelOptions } from 'node-llama-cpp'

export const KUNLUN_LOCAL_CONTEXT_MIN_TOKENS = 3072
export const KUNLUN_LOCAL_CONTEXT_MAX_TOKENS = 4096
export const KUNLUN_LOCAL_MAX_RESPONSE_TOKENS = 320

type LlamaLikeForDiagnostics = {
    gpu: unknown
    supportsGpuOffloading: boolean
    getGpuDeviceNames: () => Promise<string[]>
    getVramState: () => Promise<{
        total: number
        used: number
        free: number
        unifiedSize: number
    }>
}

type LlamaLogSink = (level: LlamaLogLevel, message: string) => void

export const shouldSuppressLlamaLog = (message: string): boolean => {
    const normalized = message.toLowerCase()
    return normalized.includes('control-looking token') &&
        normalized.includes("'</s>'") &&
        normalized.includes('not control-type')
}

const defaultLlamaLogSink: LlamaLogSink = (level, message) => {
    const line = `[llama.cpp:${level}] ${message.trim()}`
    if (level === 'error' || level === 'warn') {
        console.warn(line)
        return
    }
    console.info(line)
}

export const createKunlunLlamaLogger = (sink: LlamaLogSink = defaultLlamaLogSink): LlamaLogSink => {
    return (level, message) => {
        if (shouldSuppressLlamaLog(message)) return
        sink(level, message)
    }
}

export const buildLocalLlamaContextOptions = (): LlamaContextOptions => ({
    contextSize: {
        min: KUNLUN_LOCAL_CONTEXT_MIN_TOKENS,
        max: KUNLUN_LOCAL_CONTEXT_MAX_TOKENS
    },
    batchSize: 512,
    flashAttention: true
})

export const buildLocalLlamaModelOptions = (modelPath: string, forceCpu: boolean): LlamaModelOptions => ({
    modelPath,
    gpuLayers: forceCpu
        ? 0
        : {
            fitContext: {
                contextSize: KUNLUN_LOCAL_CONTEXT_MAX_TOKENS
            }
        }
})

const formatBytesAsGb = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(1)}GB`

export const describeLlamaRuntime = async (llama: LlamaLikeForDiagnostics): Promise<string> => {
    const [deviceNames, vram] = await Promise.all([
        llama.getGpuDeviceNames().catch(() => []),
        llama.getVramState().catch(() => null)
    ])
    const vramText = vram == null
        ? 'vram=unknown'
        : `vram=${formatBytesAsGb(vram.used)} used / ${formatBytesAsGb(vram.total)} total / ${formatBytesAsGb(vram.free)} free`
    const unifiedText = vram != null && vram.unifiedSize > 0
        ? ` unified=${formatBytesAsGb(vram.unifiedSize)}`
        : ''
    return [
        `backend=${String(llama.gpu)}`,
        `gpuOffload=${llama.supportsGpuOffloading ? 'yes' : 'no'}`,
        `device=${deviceNames.length > 0 ? deviceNames.join(', ') : 'unknown'}`,
        `${vramText}${unifiedText}`
    ].join(' ')
}

const logLlamaRuntimeDiagnostics = async (llama: LlamaLikeForDiagnostics): Promise<void> => {
    const diagnostics = await describeLlamaRuntime(llama)
    console.info(`[kunlun:llama] ${diagnostics}`)
}

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
    // gpu: 'auto' 会按 CUDA → Vulkan → Metal → CPU 的顺序探测本机能力；找不到 GPU 会自动回落到
    // 纯 CPU，因此在无显卡主机上行为与原 `gpu: false` 等价。开启后在 RTX 40 系 + 8GB VRAM
    // 上单轮 7B 推理可以从 ~6 分钟压到 ~20-40 秒，首次加载也从十几分钟降到十几秒。
    // 允许用 `KUNLUN_FORCE_CPU=1` 强制回退，方便排查显卡驱动问题。
    const forceCpu = process.env.KUNLUN_FORCE_CPU === '1'
    const llama = await getLlama({
        gpu: forceCpu ? false : 'auto' as const,
        logger: createKunlunLlamaLogger(),
        logLevel: 'warn' as LlamaLogLevel
    })
    await logLlamaRuntimeDiagnostics(llama)
    const model = await llama.loadModel(buildLocalLlamaModelOptions(modelPath, forceCpu))
    const context = await model.createContext(buildLocalLlamaContextOptions())
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        // 关键修正：走 ChatML <|im_start|>system... 模板，避免人格被当成普通用户文本骑丢。
        ...(systemPrompt != null && systemPrompt.length > 0 ? { systemPrompt } : {})
    })

    return {
        prompt: async (prompt, options) => {
            return await session.prompt(prompt, {
                maxTokens: options.maxTokens ?? KUNLUN_LOCAL_MAX_RESPONSE_TOKENS,
                onTextChunk: options.onTextChunk,
                stopOnAbortSignal: true,
                temperature: 0.88,
                topP: 0.92,
                // 压低「你是不是觉得这有点儿神奇」这类句式被反复拼贴的概率，
                // 也减少轮与轮之间模型拿上一轮输出原句复诵；lastTokens 覆盖整段回答，
                // 避免 3B 在一条回复里反复排列同一组神话名词。
                repeatPenalty: {
                    penalty: 1.18,
                    lastTokens: KUNLUN_LOCAL_MAX_RESPONSE_TOKENS,
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
