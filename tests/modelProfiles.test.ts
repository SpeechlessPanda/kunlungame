import { describe, expect, it } from 'vitest'
import {
  getDefaultModelProfile,
  getFallbackModelProfile,
  getProModelProfile,
  getAllModelProfiles,
  getOptionalModelProfiles
} from '../src/modeling/modelProfiles.js'

describe('model profiles', () => {
  it('returns the default qwen 3b quality-mode profile as a single q4_k_m file', () => {
    const profile = getDefaultModelProfile()

    expect(profile.id).toBe('qwen2.5-3b-instruct-q4km')
    expect(profile.label).toBe('Quality Mode')
    expect(profile.quantization).toBe('Q4_K_M')
    expect(profile.files).toEqual(['qwen2.5-3b-instruct-q4_k_m.gguf'])
    expect(profile.recommendedGpuVramGb).toBe(4)
  })

  it('returns the fallback qwen 1.5b lite-mode profile for weak-cpu machines', () => {
    const profile = getFallbackModelProfile()

    expect(profile.id).toBe('qwen2.5-1.5b-instruct-q4km')
    expect(profile.label).toBe('Lite Mode')
    expect(profile.files).toEqual(['qwen2.5-1.5b-instruct-q4_k_m.gguf'])
    expect(profile.recommendedGpuVramGb).toBe(0)
  })

  it('returns the pro-mode qwen 7b profile with split q4_k_m files', () => {
    const profile = getProModelProfile()

    expect(profile.id).toBe('qwen2.5-7b-instruct-q4km')
    expect(profile.label).toBe('Pro Mode')
    expect(profile.files).toEqual([
      'qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf',
      'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf'
    ])
    expect(profile.recommendedGpuVramGb).toBe(8)
  })

  it('auto-downloads the default 3B and fallback 1.5B profiles, keeping 7B opt-in', () => {
    const all = getAllModelProfiles()
    expect(all.map((p) => p.id)).toEqual([
      'qwen2.5-3b-instruct-q4km',
      'qwen2.5-1.5b-instruct-q4km'
    ])
    const optional = getOptionalModelProfiles()
    expect(optional.map((p) => p.id)).toEqual(['qwen2.5-7b-instruct-q4km'])
  })
})