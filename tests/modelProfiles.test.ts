import { describe, expect, it } from 'vitest'
import { getDefaultModelProfile, getFallbackModelProfile } from '../src/modeling/modelProfiles.js'

describe('model profiles', () => {
  it('returns the default qwen 7b profile with split q4_k_m files', () => {
    const profile = getDefaultModelProfile()

    expect(profile.id).toBe('qwen2.5-7b-instruct-q4km')
    expect(profile.quantization).toBe('Q4_K_M')
    expect(profile.files).toEqual([
      'qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf',
      'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf'
    ])
  })

  it('returns the compatibility qwen 3b profile as a single q4_k_m file', () => {
    const profile = getFallbackModelProfile()

    expect(profile.id).toBe('qwen2.5-3b-instruct-q4km')
    expect(profile.files).toEqual(['qwen2.5-3b-instruct-q4_k_m.gguf'])
  })
})