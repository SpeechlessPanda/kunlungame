import { describe, expect, it } from 'vitest'
import { buildRuntimeBootstrapPlan } from '../src/modeling/runtimeBootstrap.js'

describe('buildRuntimeBootstrapPlan', () => {
  it('prefers the default model profile when hardware is suitable', () => {
    const result = buildRuntimeBootstrapPlan({
      preferredMode: 'default',
      availableGpuVramGb: 8,
      isPackaged: true,
      projectRoot: 'D:/project/kunlungame',
      appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
    })

    expect(result.selectedProfile.id).toBe('qwen2.5-7b-instruct-q4km')
    expect(result.storage.modelsDir).toBe('C:/Users/test/AppData/Roaming/Kunlungame/models')
  })

  it('falls back to compatibility mode when user requests it explicitly', () => {
    const result = buildRuntimeBootstrapPlan({
      preferredMode: 'compatibility',
      availableGpuVramGb: 4,
      isPackaged: false,
      projectRoot: 'D:/project/kunlungame',
      appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
    })

    expect(result.selectedProfile.id).toBe('qwen2.5-3b-instruct-q4km')
    expect(result.storage.modelsDir).toBe('D:/project/kunlungame/runtime-cache/models')
  })
})
