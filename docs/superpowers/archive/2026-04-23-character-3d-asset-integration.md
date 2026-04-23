# Character 3D Asset Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add engine-agnostic 3D character asset contracts, validation tests, and exporter-facing documentation so future Blender or Unreal FBX exports can plug into the repo without redefining asset structure.

**Architecture:** Keep the existing 2D portrait contract unchanged and add a parallel runtime 3D contract in the shared content boundary. Model the integration in two layers: a source manifest for DCC provenance and a runtime manifest for game-facing consumption, then validate both with focused Vitest coverage and document the export rules for artists and engineers.

**Tech Stack:** TypeScript, Zod, Vitest, Markdown documentation

---

## File Map

### Existing files to modify

1. `src/shared/contracts/contentContracts.ts`
   Add 3D character slot schemas, source/runtime manifest schemas, helper constructors, exported types, and minimal sample objects.
2. `tests/contentContracts.test.ts`
   Keep the existing Part 02 regression coverage green and add a compatibility assertion proving portrait slots still behave as before.
3. `docs/asset-slot-rules.md`
   Extend the asset slot guide with the parallel 3D slot naming rule and explain how it coexists with the portrait slot.
4. `README.md`
   Update current scope and known-ready surfaces to mention 3D asset contract readiness.
5. `docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md`
   Update execution status and deferred items to reflect the new 3D contract layer.

### New files to create

1. `tests/character3dAssetContracts.test.ts`
   Focused black-box and white-box validation for 3D asset manifests.
2. `docs/character-3d-export.md`
   Exporter-facing reference for Blender/Unreal to FBX delivery, naming, axes, scale, textures, animation clips, facial channels, and lip sync channels.

---

### Task 1: Add The Failing 3D Contract Tests

**Files:**
- Create: `tests/character3dAssetContracts.test.ts`
- Modify: `tests/contentContracts.test.ts`
- Test: `tests/character3dAssetContracts.test.ts`
- Test: `tests/contentContracts.test.ts`

- [ ] **Step 1: Write the failing test file for the new 3D contracts**

```ts
import { describe, expect, it } from 'vitest'
import {
  createCharacterAssetSlot,
  createCharacterRuntime3dSlot,
  minimalCharacter3dRuntimeManifest,
  minimalCharacter3dSourceManifest,
  parseCharacter3dRuntimeManifest,
  parseCharacter3dSourceManifest
} from '../src/shared/contracts/contentContracts.js'

describe('parseCharacter3dSourceManifest', () => {
  it('accepts the minimal 3d source manifest example', () => {
    const result = parseCharacter3dSourceManifest(minimalCharacter3dSourceManifest)

    expect(result.characterId).toBe('hero')
    expect(result.sourceTool).toBe('blender')
    expect(result.masterFbxPath).toContain('hero.fbx')
  })
})

describe('parseCharacter3dRuntimeManifest', () => {
  it('accepts the minimal runtime 3d manifest example', () => {
    const result = parseCharacter3dRuntimeManifest(minimalCharacter3dRuntimeManifest)

    expect(result.characterId).toBe('hero')
    expect(result.runtimeModelFile).toContain('hero.fbx')
    expect(result.animationSet.idle).toContain('idle')
    expect(result.facialChannels).toContain('smile')
    expect(result.lipSyncChannels).toContain('aa')
  })

  it('rejects a runtime manifest without the minimal action set', () => {
    expect(() =>
      parseCharacter3dRuntimeManifest({
        ...minimalCharacter3dRuntimeManifest,
        animationSet: {
          idle: 'assets/characters/hero/runtime/animations/hero_idle.fbx'
        }
      })
    ).toThrow()
  })
})

describe('createCharacterRuntime3dSlot', () => {
  it('creates a stable runtime 3d slot without changing the portrait slot rule', () => {
    const portraitSlot = createCharacterAssetSlot('hero')
    const runtimeSlot = createCharacterRuntime3dSlot('hero')

    expect(portraitSlot.slotId).toBe('character.hero.portrait')
    expect(runtimeSlot.slotId).toBe('character.hero.runtime-3d')
  })
})
```

- [ ] **Step 2: Add the portrait compatibility regression to the existing Part 02 test file**

```ts
it('keeps the existing portrait slot helper unchanged while adding 3d runtime slots', () => {
  const portraitSlot = createCharacterAssetSlot('narrator')

  expect(portraitSlot.slotId).toBe('character.narrator.portrait')
  expect(portraitSlot.placeholderPolicy).toBe('static-placeholder')
})
```

- [ ] **Step 3: Run the focused tests to verify they fail for the right reason**

Run: `pnpm test -- tests/character3dAssetContracts.test.ts tests/contentContracts.test.ts`

Expected: FAIL because `createCharacterRuntime3dSlot`, `parseCharacter3dSourceManifest`, `parseCharacter3dRuntimeManifest`, and the minimal 3D manifest exports do not exist yet.

- [ ] **Step 4: Commit the failing test baseline**

```bash
git add tests/character3dAssetContracts.test.ts tests/contentContracts.test.ts
git commit -m "test: define 3d character asset contract coverage"
```

---

### Task 2: Implement The Minimal 3D Asset Contracts

**Files:**
- Modify: `src/shared/contracts/contentContracts.ts`
- Test: `tests/character3dAssetContracts.test.ts`
- Test: `tests/contentContracts.test.ts`

- [ ] **Step 1: Add the failing contract surface to `contentContracts.ts`**

```ts
export const characterSourceToolSchema = z.enum(['blender', 'unreal'])
export const runtimeAxisSchema = z.enum(['x-up', 'y-up', 'z-up'])

export const characterRuntime3dSlotSchema = z.object({
  slotId: z.string().min(1),
  slotType: z.literal('character-runtime-3d'),
  assetPath: z.string().min(1).nullable(),
  placeholderPolicy: z.literal('empty-ok')
})

export const character3dSourceManifestSchema = z.object({
  characterId: z.string().min(1),
  sourceTool: characterSourceToolSchema,
  sourceProjectPath: z.string().min(1),
  sourceScene: z.string().min(1),
  masterFbxPath: z.string().min(1),
  textureSourceDir: z.string().min(1),
  exportProfileVersion: z.string().min(1),
  notes: z.string().default('')
})

export const character3dRuntimeManifestSchema = z.object({
  characterId: z.string().min(1),
  version: z.string().min(1),
  runtimeModelFile: z.string().min(1),
  skeletonId: z.string().min(1),
  materialSet: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)),
  animationSet: z.object({
    idle: z.string().min(1),
    talk: z.string().min(1),
    react: z.string().min(1)
  }),
  facialChannels: z.array(z.string().min(1)).min(1),
  lipSyncChannels: z.array(z.string().min(1)).min(1),
  mountPoints: z.array(z.string().min(1)),
  physicsProxy: z.string().min(1).nullable(),
  lods: z.array(z.string().min(1)),
  scale: z.number().positive(),
  upAxis: runtimeAxisSchema
})
```

- [ ] **Step 2: Add parse helpers, slot helper, exported types, and minimal samples**

```ts
export type CharacterRuntime3dSlot = z.infer<typeof characterRuntime3dSlotSchema>
export type Character3dSourceManifest = z.infer<typeof character3dSourceManifestSchema>
export type Character3dRuntimeManifest = z.infer<typeof character3dRuntimeManifestSchema>

export const parseCharacter3dSourceManifest = (input: unknown): Character3dSourceManifest => {
  return character3dSourceManifestSchema.parse(input)
}

export const parseCharacter3dRuntimeManifest = (input: unknown): Character3dRuntimeManifest => {
  return character3dRuntimeManifestSchema.parse(input)
}

export const createCharacterRuntime3dSlot = (characterId: string): CharacterRuntime3dSlot => {
  return characterRuntime3dSlotSchema.parse({
    slotId: `character.${characterId}.runtime-3d`,
    slotType: 'character-runtime-3d',
    assetPath: null,
    placeholderPolicy: 'empty-ok'
  })
}

export const minimalCharacter3dSourceManifest: Character3dSourceManifest = {
  characterId: 'hero',
  sourceTool: 'blender',
  sourceProjectPath: 'assets/characters/hero/source/hero.blend',
  sourceScene: 'Hero_Main',
  masterFbxPath: 'assets/characters/hero/runtime/hero.fbx',
  textureSourceDir: 'assets/characters/hero/source/textures',
  exportProfileVersion: 'fbx-humanoid-v1',
  notes: ''
}

export const minimalCharacter3dRuntimeManifest: Character3dRuntimeManifest = {
  characterId: 'hero',
  version: '1',
  runtimeModelFile: 'assets/characters/hero/runtime/hero.fbx',
  skeletonId: 'hero-humanoid-v1',
  materialSet: {
    body: [
      'assets/characters/hero/runtime/textures/hero_body_basecolor.png',
      'assets/characters/hero/runtime/textures/hero_body_normal.png'
    ]
  },
  animationSet: {
    idle: 'assets/characters/hero/runtime/animations/hero_idle.fbx',
    talk: 'assets/characters/hero/runtime/animations/hero_talk.fbx',
    react: 'assets/characters/hero/runtime/animations/hero_react.fbx'
  },
  facialChannels: ['neutral', 'smile', 'frown'],
  lipSyncChannels: ['aa', 'ee', 'oo'],
  mountPoints: ['right-hand', 'head-look-at'],
  physicsProxy: null,
  lods: [],
  scale: 1,
  upAxis: 'z-up'
}
```

- [ ] **Step 3: Run the focused tests and expect them to pass**

Run: `pnpm test -- tests/character3dAssetContracts.test.ts tests/contentContracts.test.ts`

Expected: PASS with the new file green and the existing Part 02 regressions still green.

- [ ] **Step 4: Run type safety validation on the touched contract surface**

Run: `pnpm typecheck`

Expected: PASS with no new TypeScript or Vue type errors.

- [ ] **Step 5: Commit the minimal contract implementation**

```bash
git add src/shared/contracts/contentContracts.ts tests/character3dAssetContracts.test.ts tests/contentContracts.test.ts
git commit -m "feat: add 3d character asset contracts"
```

---

### Task 3: Document The Export Pipeline And Sync Repo Docs

**Files:**
- Create: `docs/character-3d-export.md`
- Modify: `docs/asset-slot-rules.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md`

- [ ] **Step 1: Write the dedicated exporter guide**

```md
# 角色 3D 导出规范

## 支持来源

1. Blender
2. Unreal

## 主交付格式

1. 主交付模型使用 FBX。
2. 运行时清单必须与 FBX 同步提交。

## 目录约定

1. `assets/characters/<characterId>/source/`
2. `assets/characters/<characterId>/runtime/`
3. `assets/characters/<characterId>/exports/`

## 最小动作集

1. `idle`
2. `talk`
3. `react`

## 最小面部接口

1. facial channels
2. lip sync channels

## 命名约定

1. 模型文件：`<characterId>.fbx`
2. 动作文件：`<characterId>_<action>.fbx`
3. 贴图文件：`<characterId>_<material>_<usage>.png`
```

- [ ] **Step 2: Extend the asset slot guide with the new 3D slot rule**

```md
## 角色 3D 运行时槽位

1. 命名格式：`character.<characterId>.runtime-3d`
2. 当前占位策略：`empty-ok`
3. 该槽位与 `character.<characterId>.portrait` 并行存在，不替代 portrait 槽位。
4. 运行时代码后续只能读取 runtime manifest，不直接扫描 source 目录。
```

- [ ] **Step 3: Sync README and the Part 02 spec status**

```md
README additions:

1. 当前仓库已为未来 Blender/Unreal 角色导出准备 3D 资产合同与导出规范。
2. 当前仍未包含真实 3D 加载器与渲染链路。

Part 02 spec additions:

1. 已新增并行 3D 角色资产合同，覆盖 source/runtime manifest 和 runtime-3d slot。
2. 明确延期仍包括真实资产导入和运行时渲染接线。
```

- [ ] **Step 4: Run the relevant regression tests after the doc sync**

Run: `pnpm test -- tests/character3dAssetContracts.test.ts tests/contentContracts.test.ts`

Expected: PASS, confirming the documented contract still matches the code.

- [ ] **Step 5: Commit the documentation sync**

```bash
git add docs/character-3d-export.md docs/asset-slot-rules.md README.md docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md
git commit -m "docs: add 3d character export integration guide"
```

---

## Final Verification

- [ ] **Step 1: Run the full touched-slice verification set**

Run: `pnpm test -- tests/character3dAssetContracts.test.ts tests/contentContracts.test.ts`

Expected: PASS

- [ ] **Step 2: Run repository type checks**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 3: Review the final diff for touched files only**

Run: `git diff --stat HEAD~3..HEAD`

Expected: only the contract, tests, and documentation files from this plan appear.

- [ ] **Step 4: Push the completed branch**

Run: `git push origin main`

Expected: push succeeds without authentication or remote errors.