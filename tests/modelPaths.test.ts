import { describe, expect, it } from 'vitest'
import { resolveModelStoragePaths } from '../src/modeling/modelPaths.js'

describe('resolveModelStoragePaths', () => {
  it('uses local runtime-cache paths in development', () => {
    const result = resolveModelStoragePaths({
      isPackaged: false,
      projectRoot: 'D:/project/kunlungame',
      appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
    })

    expect(result.modelsDir).toBe('D:/project/kunlungame/runtime-cache/models')
    expect(result.manifestFile).toBe('D:/project/kunlungame/runtime-cache/models/manifest.json')
  })

  it('uses per-user app data paths when packaged', () => {
    const result = resolveModelStoragePaths({
      isPackaged: true,
      projectRoot: 'D:/project/kunlungame',
      appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
    })

    expect(result.modelsDir).toBe('C:/Users/test/AppData/Roaming/Kunlungame/models')
    expect(result.manifestFile).toBe('C:/Users/test/AppData/Roaming/Kunlungame/models/manifest.json')
  })
}
)