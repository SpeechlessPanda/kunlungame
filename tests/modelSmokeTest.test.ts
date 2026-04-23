import { describe, expect, it } from 'vitest'
import { runModelSmokeTest } from '../src/modeling/modelSmokeTest.js'

describe('runModelSmokeTest', () => {
  it('reports success when the model returns non-empty text', async () => {
    const result = await runModelSmokeTest(
      {
        profileId: 'qwen2.5-3b-instruct-q4km',
        modelPath: 'D:/models/qwen.gguf'
      },
      {
        promptModel: async () => '我是昆仑故事的讲述者。'
      }
    )

    expect(result.ok).toBe(true)
    expect(result.response).toContain('昆仑')
  })

  it('returns a repairable failure when the model runner throws', async () => {
    const result = await runModelSmokeTest(
      {
        profileId: 'qwen2.5-7b-instruct-q4km',
        modelPath: 'D:/models/qwen.gguf'
      },
      {
        promptModel: async () => {
          throw new Error('Assertion failed in ggml-cpu-alderlake.dll')
        }
      }
    )

    expect(result.ok).toBe(false)
    expect(result.errorMessage).toContain('Assertion failed')
    expect(result.suggestedFix).toContain('重新下载')
  })
})