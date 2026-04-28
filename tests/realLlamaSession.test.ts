import { describe, expect, it } from 'vitest'
import type { LlamaLogLevel } from 'node-llama-cpp'
import {
  KUNLUN_LOCAL_CONTEXT_MAX_TOKENS,
  KUNLUN_LOCAL_MAX_RESPONSE_TOKENS,
  buildLocalLlamaContextOptions,
  buildLocalLlamaModelOptions,
  createKunlunLlamaLogger,
  describeLlamaRuntime,
  shouldSuppressLlamaLog
} from '../src/modeling/realLlamaSession.js'

describe('realLlamaSession helpers', () => {
  it('suppresses the noisy non-control </s> tokenizer warning only', () => {
    expect(shouldSuppressLlamaLog("control-looking token '</s>' was not control-type")).toBe(true)
    expect(shouldSuppressLlamaLog('CUDA backend failed to load')).toBe(false)
  })

  it('forwards non-suppressed llama logs to the provided sink', () => {
    const logs: Array<{ level: string; message: string }> = []
    const logger = createKunlunLlamaLogger((level, message) => logs.push({ level, message }))

    logger('warn' as LlamaLogLevel, "control-looking token '</s>' was not control-type")
    logger('warn' as LlamaLogLevel, 'real warning')

    expect(logs).toEqual([{ level: 'warn', message: 'real warning' }])
  })

  it('uses bounded local context and shorter response defaults for faster turns', () => {
    expect(KUNLUN_LOCAL_CONTEXT_MAX_TOKENS).toBe(4096)
    expect(KUNLUN_LOCAL_MAX_RESPONSE_TOKENS).toBe(320)
    expect(buildLocalLlamaContextOptions()).toMatchObject({
      contextSize: { min: 3072, max: 4096 },
      batchSize: 512,
      flashAttention: true
    })
    expect(buildLocalLlamaModelOptions('model.gguf', false)).toMatchObject({
      modelPath: 'model.gguf',
      gpuLayers: { fitContext: { contextSize: 4096 } }
    })
    expect(buildLocalLlamaModelOptions('model.gguf', true)).toMatchObject({
      modelPath: 'model.gguf',
      gpuLayers: 0
    })
  })

  it('describes llama GPU backend, device names, and VRAM state', async () => {
    const diagnostics = await describeLlamaRuntime({
      gpu: 'cuda',
      supportsGpuOffloading: true,
      getGpuDeviceNames: async () => ['NVIDIA RTX 4060'],
      getVramState: async () => ({
        total: 8 * 1024 ** 3,
        used: 2 * 1024 ** 3,
        free: 6 * 1024 ** 3,
        unifiedSize: 0
      })
    })

    expect(diagnostics).toContain('backend=cuda')
    expect(diagnostics).toContain('gpuOffload=yes')
    expect(diagnostics).toContain('device=NVIDIA RTX 4060')
    expect(diagnostics).toContain('vram=2.0GB used / 8.0GB total')
  })
})