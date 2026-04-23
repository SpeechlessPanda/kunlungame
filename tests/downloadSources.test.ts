import { describe, expect, it } from 'vitest'
import { buildDownloadSources } from '../src/modeling/downloadSources.js'

describe('buildDownloadSources', () => {
  it('returns primary and mirror URLs for the same repo file', () => {
    const result = buildDownloadSources('Qwen/Qwen2.5-3B-Instruct-GGUF', 'qwen2.5-3b-instruct-q4_k_m.gguf')

    expect(result).toEqual([
      'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf?download=true',
      'https://hf-mirror.com/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf?download=true'
    ])
  })
})
