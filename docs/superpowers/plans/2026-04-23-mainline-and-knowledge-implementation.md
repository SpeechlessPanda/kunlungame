# Kunlun Mainline And Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将《昆仑谣》的文化知识库落成可运行的单主线内容层，补齐 Part 02 到 Part 05 的真实实现边界，并在继续 Part 05 前补录 Part 01 到 Part 04 的审计记录。

**Architecture:** 保持现有分层不变：Part 02 负责内容合同与主线源数据，Part 03 负责从原始文化知识 Markdown 编译出结构化检索数据与运行时 story outline，Part 04 负责单主线状态推进与恢复，Part 05 负责基于当前节点与检索结果构建中文 prompt、输出流事件和动态双选项。Part 06 跳过，Part 07 只补非 UI 的资源位与模式契约。

**Tech Stack:** TypeScript, Zod, Vitest, tsx, existing Electron/Vite workspace, JSON generated content

---

## File Structure

**Create:**

- `docs/audits/2026-04-23-part-01-04-audit.md`
- `docs/superpowers/plans/2026-04-23-mainline-and-knowledge-implementation.md`
- `src/content/source/mainlineOutline.ts`
- `src/content/generated/storyOutline.json`
- `src/modeling/storyPromptBuilder.ts`
- `src/modeling/dialogueOrchestrator.ts`
- `tests/storyPromptBuilder.test.ts`
- `tests/dialogueOrchestrator.test.ts`

**Modify:**

- `src/shared/contracts/contentContracts.ts`
- `src/modeling/knowledgeCompilation.ts`
- `scripts/compile-knowledge.ts`
- `src/content/generated/knowledgeEntries.json`
- `src/runtime/runtimeState.ts`
- `tests/contentContracts.test.ts`
- `tests/knowledgeCompilation.test.ts`
- `tests/runtimeState.test.ts`
- `docs/content-markdown-format.md`
- `docs/knowledge-compilation.md`
- `docs/runtime-state.md`
- `docs/asset-slot-rules.md`
- `docs/model-runtime.md`
- `docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md`
- `docs/superpowers/specs/2026-04-23-part-03-knowledge-compilation-and-retrieval-spec.md`
- `docs/superpowers/specs/2026-04-23-part-04-runtime-state-and-persistence-spec.md`
- `docs/superpowers/specs/2026-04-23-part-05-ai-orchestration-and-streaming-spec.md`

**Keep generated-only:**

- `src/content/generated/storyOutline.json`
- `src/content/generated/knowledgeEntries.json`

### Task 0: Backfill Part 01-04 Audit Gate

**Files:**

- Create: `docs/audits/2026-04-23-part-01-04-audit.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-01-foundation-and-desktop-shell-spec.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-03-knowledge-compilation-and-retrieval-spec.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-04-runtime-state-and-persistence-spec.md`

- [ ] **Step 1: Write the audit document before changing implementation code**

```md
# Part 01-04 Audit Record

## Scope

- Part 01 desktop shell
- Part 02 content contracts
- Part 03 knowledge compilation
- Part 04 runtime state and persistence

## Checks

- Dependency and security review: current lockfile only; no new advisories reviewed in this pass
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test`
- E2E smoke: `pnpm test:e2e`
- Build: `pnpm build`
- Knowledge compile: `pnpm knowledge:compile`

## Result

- Passed:
- Failed:
- Deferred:
```

- [ ] **Step 2: Run the existing verification suite and paste the results into the audit record**

Run: `pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build && pnpm knowledge:compile`

Expected: all commands succeed and the audit file records exact pass/deferred status instead of a prose summary.

- [ ] **Step 3: Update the Part 01-04 specs so their execution status points at the audit record**

```md
## Execution Status

Status: completed

Audit:

- See `docs/audits/2026-04-23-part-01-04-audit.md`
```

- [ ] **Step 4: Re-run only the changed docs sanity checks**

Run: `pnpm knowledge:compile`

Expected: PASS, confirming no later content tasks are blocked by doc edits or stale generated data.

- [ ] **Step 5: Commit the audit gate**

```bash
git add docs/audits/2026-04-23-part-01-04-audit.md docs/superpowers/specs/2026-04-23-part-01-foundation-and-desktop-shell-spec.md docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md docs/superpowers/specs/2026-04-23-part-03-knowledge-compilation-and-retrieval-spec.md docs/superpowers/specs/2026-04-23-part-04-runtime-state-and-persistence-spec.md
git commit -m "docs: backfill part 01-04 audit record"
```

### Task 1: Extend Content Contracts For The Real Mainline

**Files:**

- Create: `src/content/source/mainlineOutline.ts`
- Modify: `src/shared/contracts/contentContracts.ts`
- Test: `tests/contentContracts.test.ts`
- Modify: `docs/content-markdown-format.md`
- Modify: `docs/asset-slot-rules.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md`

- [ ] **Step 1: Write the failing contract tests for the new story node shape**

```ts
it('accepts the approved mainline node fields', () => {
  expect(() =>
    parseStoryOutline({
      entryNodeId: 'kunlun-threshold',
      nodes: [
        {
          id: 'kunlun-threshold',
          title: '昆仑初问',
          era: 'myth-origin',
          theme: '文明原点',
          coreQuestion: '我们为什么从昆仑开始回望自己？',
          summary: '建立文明回廊入口。',
          mustIncludeFacts: ['昆仑是世界中心'],
          retrievalKeywords: ['昆仑', '西王母'],
          recommendedFigures: ['西王母'],
          allowedKnowledgeTopics: ['myth-origin'],
          forbiddenFutureTopics: ['contemporary-return'],
          backgroundMode: 'fictional',
          backgroundHint: '远古雪山与天门',
          toneHint: '邀请式中文导览',
          characterCueIds: ['guide.kunlun'],
          minTurns: 1,
          nextNodeId: null
        }
      ]
    })
  ).not.toThrow()
})
```

- [ ] **Step 2: Run the focused contract test to confirm the current schema is too small**

Run: `pnpm vitest run tests/contentContracts.test.ts`

Expected: FAIL with unknown or missing schema fields such as `coreQuestion`, `mustIncludeFacts`, or `allowedKnowledgeTopics`.

- [ ] **Step 3: Implement the contract expansion and author the canonical mainline outline source**

```ts
export const storyNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  era: z.string().min(1),
  theme: z.string().min(1),
  coreQuestion: z.string().min(1),
  summary: z.string().min(1),
  mustIncludeFacts: z.array(z.string().min(1)).min(1),
  retrievalKeywords: z.array(z.string().min(1)).min(1),
  recommendedFigures: z.array(z.string().min(1)).min(1),
  allowedKnowledgeTopics: z.array(z.string().min(1)).min(1),
  forbiddenFutureTopics: z.array(z.string().min(1)).default([]),
  backgroundMode: backgroundModeSchema,
  backgroundHint: z.string().min(1),
  toneHint: z.string().min(1),
  characterCueIds: z.array(z.string().min(1)).default([]),
  minTurns: z.number().int().min(1),
  nextNodeId: z.string().min(1).nullable()
})

export const mainlineStoryOutline: StoryOutline = {
  entryNodeId: 'kunlun-threshold',
  nodes: [
    {
      id: 'kunlun-threshold',
      title: '昆仑初问',
      era: 'myth-origin',
      theme: '文明原点',
      coreQuestion: '我们为什么从昆仑开始回望自己？',
      summary: '建立现代青年进入文明回廊的开场。',
      mustIncludeFacts: ['昆仑被视为世界中心', '昆仑是精神坐标'],
      retrievalKeywords: ['昆仑', '西王母', '天柱'],
      recommendedFigures: ['西王母'],
      allowedKnowledgeTopics: ['myth-origin'],
      forbiddenFutureTopics: ['rupture-and-guardianship', 'contemporary-return'],
      backgroundMode: 'fictional',
      backgroundHint: '远古雪山与云海',
      toneHint: '亲切邀请，但保留史诗感',
      characterCueIds: ['guide.kunlun'],
      minTurns: 1,
      nextNodeId: 'creation-myths'
    }
  ]
}
```

- [ ] **Step 4: Re-run the contract suite and add chain validation assertions for all 8 nodes**

Run: `pnpm vitest run tests/contentContracts.test.ts`

Expected: PASS, with assertions that the outline is a single chain and that each node carries approved anti-spoiler fields.

- [ ] **Step 5: Update the content and asset docs to match the new schema and 3D cue placeholders**

```md
## Story Outline Fields

- `coreQuestion`: 当前节点必须回答的问题
- `mustIncludeFacts`: 当前节点不可遗漏的事实清单
- `allowedKnowledgeTopics`: 当前节点允许检索的主题
- `forbiddenFutureTopics`: 当前节点禁止提前泄露的主题
- `characterCueIds`: 角色或向导资源位 cue，不绑定真实资产路径
```

- [ ] **Step 6: Commit the contract slice**

```bash
git add src/content/source/mainlineOutline.ts src/shared/contracts/contentContracts.ts tests/contentContracts.test.ts docs/content-markdown-format.md docs/asset-slot-rules.md docs/superpowers/specs/2026-04-23-part-02-narrative-content-and-asset-contracts-spec.md
git commit -m "feat: define structured mainline content contracts"
```

### Task 2: Compile The Cultural Markdown Into Structured Runtime Data

**Files:**

- Modify: `src/modeling/knowledgeCompilation.ts`
- Modify: `scripts/compile-knowledge.ts`
- Modify: `src/content/generated/knowledgeEntries.json`
- Create: `src/content/generated/storyOutline.json`
- Test: `tests/knowledgeCompilation.test.ts`
- Modify: `docs/knowledge-compilation.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-03-knowledge-compilation-and-retrieval-spec.md`

- [ ] **Step 1: Write failing tests that lock the new compiler output shape**

```ts
it('compiles the cultural knowledge markdown into entries and story outline output', async () => {
  const result = await compileKnowledgeSources({
    knowledgeSourceFile: fixturePath('cultural-knowledge.md'),
    storyOutline: mainlineStoryOutline,
    outputDir: tempDir
  })

  expect(result.storyOutline.entryNodeId).toBe('kunlun-threshold')
  expect(result.entries.some((entry) => entry.topic === 'myth-origin')).toBe(true)
  expect(result.entries.every((entry) => entry.applicableNodeIds.length > 0)).toBe(true)
})

it('does not return future-node knowledge during retrieval fallback', () => {
  const result = retrieveKnowledgeEntries({
    entries,
    currentNodeId: 'kunlun-threshold',
    allowedTopics: ['myth-origin'],
    keywords: ['昆仑'],
    limit: 3
  })

  expect(result.entries.every((entry) => entry.applicableNodeIds.includes('kunlun-threshold'))).toBe(true)
})
```

- [ ] **Step 2: Run the focused compilation tests to capture the current mismatch**

Run: `pnpm vitest run tests/knowledgeCompilation.test.ts`

Expected: FAIL because the current compiler only understands front matter fragments and emits a single flat array.

- [ ] **Step 3: Implement a compiler that reads the canonical cultural markdown and emits two runtime artifacts**

```ts
export interface CompileKnowledgeSourcesInput {
  knowledgeSourceFile: string
  storyOutline: StoryOutline
  outputDir: string
}

export interface CompileKnowledgeSourcesResult {
  storyOutline: StoryOutline
  entries: KnowledgeEntry[]
}

export const compileKnowledgeSources = async (
  input: CompileKnowledgeSourcesInput
): Promise<CompileKnowledgeSourcesResult> => {
  const markdown = await readFile(input.knowledgeSourceFile, 'utf8')
  const entries = parseCulturalKnowledgeMarkdown(markdown, input.storyOutline)

  await writeFile(join(input.outputDir, 'storyOutline.json'), `${JSON.stringify(input.storyOutline, null, 2)}\n`)
  await writeFile(join(input.outputDir, 'knowledgeEntries.json'), `${JSON.stringify(entries, null, 2)}\n`)

  return {
    storyOutline: input.storyOutline,
    entries
  }
}
```

- [ ] **Step 4: Tighten retrieval so fallback stays inside the current node boundary**

```ts
const eligibleEntries = input.entries.filter((entry) => {
  const topicAllowed = input.allowedTopics.length === 0 || input.allowedTopics.includes(entry.topic)
  const nodeAllowed = entry.applicableNodeIds.includes(input.currentNodeId)
  return topicAllowed && nodeAllowed
})

if (eligibleEntries.length === 0) {
  return {
    entries: [],
    fallbackUsed: true
  }
}
```

- [ ] **Step 5: Update the compile script to use the approved sources and output both generated files**

```ts
const knowledgeSourceFile = join(projectRoot, 'docs', 'knowledge-base', 'cultural-knowledge.md')
const outputDir = join(projectRoot, 'src', 'content', 'generated')
const result = await compileKnowledgeSources({
  knowledgeSourceFile,
  storyOutline: mainlineStoryOutline,
  outputDir
})

console.log(`Compiled ${result.entries.length} entries and story outline to ${outputDir}.`)
```

- [ ] **Step 6: Run the compiler and the focused test suite**

Run: `pnpm knowledge:compile && pnpm vitest run tests/knowledgeCompilation.test.ts`

Expected: PASS, with fresh `src/content/generated/storyOutline.json` and an expanded `src/content/generated/knowledgeEntries.json` checked in.

- [ ] **Step 7: Update the knowledge compilation docs and spec status**

```md
## Outputs

- `src/content/generated/storyOutline.json`
- `src/content/generated/knowledgeEntries.json`

## Source Of Truth

- `docs/knowledge-base/cultural-knowledge.md`
- `src/content/source/mainlineOutline.ts`
```

- [ ] **Step 8: Commit the compilation slice**

```bash
git add src/modeling/knowledgeCompilation.ts scripts/compile-knowledge.ts src/content/generated/storyOutline.json src/content/generated/knowledgeEntries.json tests/knowledgeCompilation.test.ts docs/knowledge-compilation.md docs/superpowers/specs/2026-04-23-part-03-knowledge-compilation-and-retrieval-spec.md
git commit -m "feat: compile structured cultural knowledge runtime data"
```

### Task 3: Align Runtime State With The Real Mainline

**Files:**

- Modify: `src/runtime/runtimeState.ts`
- Test: `tests/runtimeState.test.ts`
- Modify: `docs/runtime-state.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-04-runtime-state-and-persistence-spec.md`

- [ ] **Step 1: Write failing runtime tests for single-chain recovery and memory-summary semantics**

```ts
it('starts from the structured outline entry node', () => {
  const state = createDefaultRuntimeState(mainlineStoryOutline)
  expect(state.currentNodeId).toBe('kunlun-threshold')
})

it('advances only through nextNodeId while preserving mainline facts', () => {
  const state = applyPlayerChoice({
    state: createDefaultRuntimeState(mainlineStoryOutline),
    storyOutline: mainlineStoryOutline,
    choice: 'challenge'
  })

  expect(state.currentNodeId).toBe('creation-myths')
  expect(state.turnIndex).toBe(1)
})

it('rejects saves that point to nodes no longer present in the outline', () => {
  expect(() => resolveRuntimeStateAgainstStoryOutline(staleState, mainlineStoryOutline)).toThrow(
    /not present/
  )
})
```

- [ ] **Step 2: Run the runtime suite and verify the current outline assumptions are still placeholder-only**

Run: `pnpm vitest run tests/runtimeState.test.ts`

Expected: FAIL or require updates because the current tests only cover the placeholder one-node outline.

- [ ] **Step 3: Implement summary and progression rules that reflect repaired cultural memory**

```ts
const buildHistorySummary = (node: StoryNode, previousSummary: string): string => {
  const repairedMemory = `${node.title}：${node.coreQuestion}`
  return previousSummary.trim() === '' ? repairedMemory : `${previousSummary}\n${repairedMemory}`
}

export const applyPlayerChoice = (input: ApplyPlayerChoiceInput): RuntimeState => {
  const currentNode = resolveCurrentNode(input.storyOutline, input.state.currentNodeId)
  const nextNodeId = resolveNextNodeId(input.storyOutline, currentNode.id, currentNode.nextNodeId)

  return runtimeStateSchema.parse({
    ...input.state,
    currentNodeId: nextNodeId,
    turnIndex: input.state.turnIndex + 1,
    attitudeScore: clampAttitude(input.state.attitudeScore + (input.choice === 'align' ? 1 : -1)),
    historySummary: buildHistorySummary(currentNode, input.state.historySummary),
    readNodeIds: [...new Set([...input.state.readNodeIds, currentNode.id])]
  })
}
```

- [ ] **Step 4: Re-run the focused runtime suite**

Run: `pnpm vitest run tests/runtimeState.test.ts`

Expected: PASS, covering entry node, next-node progression, save recovery, and style-only choice behavior.

- [ ] **Step 5: Sync the runtime docs and Part 04 spec**

```md
## Mainline Recovery Rules

- entry node is loaded from `storyOutline.entryNodeId`
- saves must reference a valid current node
- history summaries represent repaired cultural memory, not raw chat logs
- attitude score changes style only; it never forks story progression
```

- [ ] **Step 6: Commit the runtime slice**

```bash
git add src/runtime/runtimeState.ts tests/runtimeState.test.ts docs/runtime-state.md docs/superpowers/specs/2026-04-23-part-04-runtime-state-and-persistence-spec.md
git commit -m "feat: align runtime state with structured mainline"
```

### Task 4: Build The Part 05 Prompt And Orchestration Layer

**Files:**

- Create: `src/modeling/storyPromptBuilder.ts`
- Create: `src/modeling/dialogueOrchestrator.ts`
- Modify: `src/modeling/layeredContextBuilder.ts`
- Test: `tests/storyPromptBuilder.test.ts`
- Test: `tests/dialogueOrchestrator.test.ts`
- Modify: `docs/model-runtime.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-05-ai-orchestration-and-streaming-spec.md`

- [ ] **Step 1: Write failing prompt-builder tests for Chinese output, anti-spoiler rules, and option semantics**

```ts
it('builds a Chinese prompt with node facts and anti-spoiler boundaries', () => {
  const prompt = buildStoryPrompt({
    currentNode,
    retrievedEntries,
    runtimeState,
    attitudeChoiceMode: 'align'
  })

  expect(prompt.system).toContain('始终使用中文回答')
  expect(prompt.system).toContain('不得剧透后续节点')
  expect(prompt.user).toContain(currentNode.coreQuestion)
  expect(prompt.user).toContain(currentNode.mustIncludeFacts[0])
})
```

- [ ] **Step 2: Write failing orchestration tests for stream event order and dynamic options**

```ts
it('emits chunk, options, and complete events in order', async () => {
  const events = await collectDialogueEvents(orchestrateDialogue(fakeDependencies, input))

  expect(events.map((event) => event.type)).toEqual(['chunk', 'chunk', 'options', 'complete'])
  expect(events.at(-2)).toMatchObject({
    type: 'options',
    options: [
      { semantic: 'align' },
      { semantic: 'challenge' }
    ]
  })
})
```

- [ ] **Step 3: Run the focused AI-layer tests and confirm the implementation does not exist yet**

Run: `pnpm vitest run tests/storyPromptBuilder.test.ts tests/dialogueOrchestrator.test.ts`

Expected: FAIL with missing module or missing exported symbol errors.

- [ ] **Step 4: Implement the prompt builder on top of the existing layered context helper**

```ts
export const buildStoryPrompt = (input: StoryPromptBuilderInput): StoryPrompt => {
  const systemRules = [
    '你是《昆仑谣》的文化陪伴者。',
    '始终使用中文回答。',
    '玩家只有两个选项：附和型与反驳型。',
    '这些选项只影响语气，不影响主线事实。',
    `当前节点禁止提前涉及：${input.currentNode.forbiddenFutureTopics.join('、') || '无'}`
  ]

  const context = buildLayeredContext({
    systemRules,
    currentNode: {
      title: input.currentNode.title,
      summary: `${input.currentNode.coreQuestion}\n${input.currentNode.summary}`
    },
    retrievedKnowledge: input.retrievedEntries.map((entry) => `${entry.title}\n${entry.summary}`),
    memorySummary: input.runtimeState.historySummary,
    recentTurns: input.recentTurns
  })

  return {
    system: systemRules.join('\n'),
    user: context
  }
}
```

- [ ] **Step 5: Implement the orchestration facade with explicit stream events and option generation**

```ts
export type DialogueEvent =
  | { type: 'chunk'; text: string }
  | { type: 'options'; options: Array<{ semantic: 'align' | 'challenge'; label: string }> }
  | { type: 'complete' }
  | { type: 'error'; message: string; retryable: boolean }

export async function* orchestrateDialogue(
  dependencies: DialogueDependencies,
  input: DialogueOrchestratorInput
): AsyncGenerator<DialogueEvent> {
  const prompt = buildStoryPrompt(input)

  for await (const chunk of dependencies.streamText(prompt)) {
    yield { type: 'chunk', text: chunk }
  }

  yield {
    type: 'options',
    options: await dependencies.generateOptions({
      currentNode: input.currentNode,
      semantics: ['align', 'challenge']
    })
  }

  yield { type: 'complete' }
}
```

- [ ] **Step 6: Re-run the focused AI-layer tests**

Run: `pnpm vitest run tests/storyPromptBuilder.test.ts tests/dialogueOrchestrator.test.ts`

Expected: PASS, proving the prompt contains the approved boundaries and the event order is deterministic.

- [ ] **Step 7: Sync the runtime-model docs and Part 05 spec status**

```md
## Dialogue Event Contract

- `chunk`: streaming text fragment
- `options`: two dynamic Chinese labels mapped to `align` and `challenge`
- `complete`: successful round end
- `error`: failed round with retry signal
```

- [ ] **Step 8: Commit the Part 05 slice**

```bash
git add src/modeling/storyPromptBuilder.ts src/modeling/dialogueOrchestrator.ts src/modeling/layeredContextBuilder.ts tests/storyPromptBuilder.test.ts tests/dialogueOrchestrator.test.ts docs/model-runtime.md docs/superpowers/specs/2026-04-23-part-05-ai-orchestration-and-streaming-spec.md
git commit -m "feat: add mainline-aware ai orchestration"
```

### Task 5: Run Cross-Slice Verification And Prepare The Next Execution Gate

**Files:**

- Modify: `docs/asset-slot-rules.md`
- Modify: `docs/model-runtime.md`
- Modify: `docs/superpowers/specs/2026-04-23-part-07-visual-presentation-and-asset-slot-spec.md`

- [ ] **Step 1: Add the non-UI Part 07 cue rules needed by the new mainline**

```md
## Character Cue Rules

- `guide.kunlun`:文化向导占位 cue
- `player.memory-self`:现代青年主角占位 cue
- story nodes may reference cue ids before real assets exist
- cue ids must not contain renderer-specific file paths
```

- [ ] **Step 2: Run the full verification pass for the completed non-UI slices**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm knowledge:compile`

Expected: PASS, with generated content up to date and no contract drift across Part 02-05.

- [ ] **Step 3: If a local model is available, run the targeted integration check for mainline + model cooperation**

Run: `pnpm vitest run tests/storyPromptBuilder.test.ts tests/dialogueOrchestrator.test.ts tests/knowledgeCompilation.test.ts tests/runtimeState.test.ts`

Expected: PASS, then manually smoke-check one round through the orchestration facade against the local model to confirm Chinese output and no future-node leakage.

- [ ] **Step 4: Record what remains intentionally deferred**

```md
## Deferred After Part 05

- Part 06 UI shell
- Part 07 renderer-side stage components
- Part 08 end-to-end acceptance and release audit
```

- [ ] **Step 5: Commit the non-UI verification slice**

```bash
git add docs/asset-slot-rules.md docs/model-runtime.md docs/superpowers/specs/2026-04-23-part-07-visual-presentation-and-asset-slot-spec.md
git commit -m "docs: sync non-ui asset cue rules"
```

## Self-Review Checklist

1. Spec coverage:
   - Mainline node chain is covered in Task 1.
   - Knowledge structure and anti-spoiler retrieval are covered in Task 2.
   - Runtime progression and recovery are covered in Task 3.
   - Chinese prompt, dynamic options, and stream events are covered in Task 4.
   - Part 07 non-UI cue follow-up and verification gate are covered in Task 5.
   - Part 01-04 audit prerequisite is covered in Task 0.
2. Placeholder scan:
   - No `TODO`, `TBD`, or “implement later” instructions remain in the plan body.
3. Type consistency:
   - Story node fields use the same names throughout: `coreQuestion`, `mustIncludeFacts`, `allowedKnowledgeTopics`, `forbiddenFutureTopics`, `characterCueIds`, `minTurns`.
   - Dialogue option semantics use the existing runtime enum names: `align` and `challenge`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-mainline-and-knowledge-implementation.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints