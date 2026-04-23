# Kunlun Ballad Desktop Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop narrative game that teaches culture connected to 《昆仑谣》 through a single main storyline, RAG-backed AI dialogue, dynamic two-choice interactions, streaming output, and save/resume.

**Architecture:** Use Electron as the desktop shell and Vue 3 as the renderer. Keep storyline state, knowledge retrieval, AI orchestration, and presentation isolated so the project can accept later content and art updates without changing the core runtime.

**Tech Stack:** Electron, Vue 3, TypeScript, Vite, Pinia, Node file system APIs, OpenAI-compatible streaming API, Vitest, Playwright.

---

## Background Art Direction

The background system should mix fictional imagery and real-world culture-related photography.

1. Fictional imagery is for mythic, symbolic, dreamlike, or time-transcending spaces such as Kunlun peaks, celestial roads, ritual visions, cloud seas, and stylized transitions.
2. Real photography is for culturally grounded presence such as mountains, temples, bronzes, steles, manuscripts, museum artifacts, murals, libraries, courtyards, and heritage architecture.
3. Composite scenes can blend photography with painted fog, silk textures, bronze patina, glyphs, or calligraphic overlays when a node needs to bridge mythology and historical reality.
4. Mainline content setup must explicitly reference this background strategy. Each story node should choose a background category based on whether the node is primarily mythic, documentary-cultural, or transitional.
5. Background changes are part of narrative meaning, not decoration. The player should feel the movement from symbolic origin, to historical sediment, to contemporary return.

Recommended background sets for later asset preparation:

1. Mythic fictional set: Kunlun summit, sacred pass, star-lit mountain path, ritual cloud palace, dreamlike heaven-earth threshold.
2. Historical fictional set: stylized ritual hall, bamboo-slip study, long-scroll city silhouette, symbolic civilizational corridor.
3. Real-photo set: real mountains, temple courtyards, museum bronzes, carved stone tablets, manuscript displays, traditional architecture, cultural heritage spaces.
4. Transitional composite set: real photos mixed with mist, bronze texture, glyph overlays, silk fibers, or painted light.

## Planned File Structure

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `electron.vite.config.ts`
- Create: `electron/main/index.ts`
- Create: `electron/preload/index.ts`
- Create: `src/renderer/main.ts`
- Create: `src/renderer/App.vue`
- Create: `src/renderer/router/index.ts`
- Create: `src/renderer/stores/game.ts`
- Create: `src/renderer/stores/settings.ts`
- Create: `src/renderer/components/GameShell.vue`
- Create: `src/renderer/components/DialogPanel.vue`
- Create: `src/renderer/components/ChoiceButtons.vue`
- Create: `src/renderer/components/BackgroundStage.vue`
- Create: `src/renderer/components/BgmPlayer.vue`
- Create: `src/shared/types/story.ts`
- Create: `src/shared/types/knowledge.ts`
- Create: `src/shared/types/ai.ts`
- Create: `src/shared/config/storyNodes.json`
- Create: `content/source/kunlun-notes.md`
- Create: `content/compiled/knowledge.json`
- Create: `scripts/compile-knowledge.ts`
- Create: `src/main/services/contentRepository.ts`
- Create: `src/main/services/storyEngine.ts`
- Create: `src/main/services/attitudeEngine.ts`
- Create: `src/main/services/knowledgeRetriever.ts`
- Create: `src/main/services/promptBuilder.ts`
- Create: `src/main/services/openaiStreamClient.ts`
- Create: `src/main/services/saveRepository.ts`
- Create: `src/main/services/gameFacade.ts`
- Create: `tests/unit/attitudeEngine.test.ts`
- Create: `tests/unit/knowledgeRetriever.test.ts`
- Create: `tests/unit/promptBuilder.test.ts`
- Create: `tests/unit/storyEngine.test.ts`
- Create: `tests/unit/gameFacade.test.ts`
- Create: `tests/helpers/collectStream.ts`
- Create: `tests/e2e/game-shell.spec.ts`
- Create: `docs/content-format.md`
- Modify: `md/昆仑谣.md`

## Task 1: Scaffold The Desktop App

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `electron.vite.config.ts`
- Create: `electron/main/index.ts`
- Create: `electron/preload/index.ts`
- Create: `src/renderer/main.ts`
- Create: `src/renderer/App.vue`

- [ ] **Step 1: Create the Electron + Vue + TypeScript scaffold**

Run: `pnpm create electron-vite . --template vue-ts`
Expected: project scaffold created with Electron, renderer, and TypeScript files.

- [ ] **Step 2: Install runtime dependencies**

Run: `pnpm add pinia zod gray-matter markdown-it openai`
Expected: dependencies installed without audit blockers that prevent local development.

- [ ] **Step 3: Install test dependencies**

Run: `pnpm add -D vitest @vitest/coverage-v8 @vue/test-utils jsdom @playwright/test`
Expected: test toolchain added to `package.json`.

- [ ] **Step 4: Replace the default Electron main process with a minimal app shell**

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

const createWindow = (): void => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    return
  }

  window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(createWindow)
```

- [ ] **Step 5: Replace the default Vue root with a game shell mount point**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 6: Run the app to verify the shell opens**

Run: `pnpm dev`
Expected: Electron window opens and renders the Vue app.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vite.config.ts electron.vite.config.ts electron src
git commit -m "chore: scaffold electron vue desktop app"
```

## Task 2: Define Domain Types And Story Content Contracts

**Files:**

- Create: `src/shared/types/story.ts`
- Create: `src/shared/types/knowledge.ts`
- Create: `src/shared/types/ai.ts`
- Create: `src/shared/config/storyNodes.json`
- Modify: `md/昆仑谣.md`
- Test: `tests/unit/storyEngine.test.ts`

- [ ] **Step 1: Write the failing story contract test**

```ts
import { describe, expect, it } from 'vitest'
import storyNodes from '../../src/shared/config/storyNodes.json'

describe('story nodes', () => {
  it('defines a single-line sequence with required fields', () => {
    expect(storyNodes.length).toBeGreaterThan(0)
    expect(storyNodes[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      theme: expect.any(String),
      retrievalKeywords: expect.any(Array),
      nextNodeId: expect.any(String)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/storyEngine.test.ts`
Expected: FAIL because config and domain types do not exist yet.

- [ ] **Step 3: Define story and knowledge types**

```ts
export interface StoryNode {
  id: string
  title: string
  theme: string
  summary: string
  retrievalKeywords: string[]
  backgroundMode: 'fictional' | 'photographic' | 'composite'
  backgroundHint: string
  toneHint: string
  nextNodeId: string | null
}

export interface KnowledgeEntry {
  id: string
  topic: string
  source: string
  summary: string
  extension: string
  storyNodeIds: string[]
  keywords: string[]
}
```

- [ ] **Step 4: Seed a minimal node config that leaves story details configurable later**

```json
[
  {
    "id": "opening",
    "title": "开场",
    "theme": "昆仑与源头",
    "summary": "引导玩家进入单线叙事并建立对话关系。",
    "retrievalKeywords": ["昆仑", "源头", "神话"],
    "backgroundMode": "fictional",
    "backgroundHint": "mountain-dawn",
    "toneHint": "mysterious",
    "nextNodeId": "node-2"
  }
]
```

- [ ] **Step 5: Update the lyric source file with machine-readable section markers**

```md
## 歌词原文

...原歌词...

## 后续内容设计提示

- 这里保留为人工扩写的内容源。
- 后续文化条目围绕歌词母题整理，不在此文件直接写结构化 JSON。
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/storyEngine.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/shared md/昆仑谣.md tests/unit/storyEngine.test.ts
git commit -m "feat: define story and knowledge contracts"
```

## Task 3: Build The Markdown-To-Knowledge Compilation Pipeline

**Files:**

- Create: `content/source/kunlun-notes.md`
- Create: `content/compiled/knowledge.json`
- Create: `scripts/compile-knowledge.ts`
- Create: `src/main/services/contentRepository.ts`
- Test: `tests/unit/knowledgeRetriever.test.ts`
- Create: `docs/content-format.md`

- [ ] **Step 1: Write the failing compiler test**

```ts
import { describe, expect, it } from 'vitest'
import { compileMarkdownKnowledge } from '../../scripts/compile-knowledge'

describe('compileMarkdownKnowledge', () => {
  it('turns markdown sections into structured entries', async () => {
    const entries = await compileMarkdownKnowledge('content/source/kunlun-notes.md')
    expect(entries[0]).toMatchObject({
      topic: expect.any(String),
      source: expect.any(String),
      summary: expect.any(String),
      storyNodeIds: expect.any(Array)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/knowledgeRetriever.test.ts`
Expected: FAIL because the compiler does not exist.

- [ ] **Step 3: Define the authoring format in Markdown**

```md
# 条目：昆仑

source: 山海经等神话脉络
storyNodeIds: opening
keywords: 昆仑, 神山, 源头

## 摘要
昆仑在中国神话语境中常作为世界中心、神圣高地或文明源头意象。

## 延伸
可延伸到天地秩序、神话地理与文化记忆。
```

- [ ] **Step 4: Implement the compiler and JSON output**

```ts
import { readFile, writeFile } from 'node:fs/promises'
import matter from 'gray-matter'

export const compileMarkdownKnowledge = async (filePath: string) => {
  const raw = await readFile(filePath, 'utf8')
  const sections = raw.split('\n# ').filter(Boolean)

  return sections.map((section, index) => {
    const normalized = index === 0 ? `# ${section}` : `# ${section}`
    const parsed = matter(normalized)

    return {
      id: `entry-${index + 1}`,
      topic: parsed.data['topic'] ?? parsed.content.match(/^#\s+条目：(.+)$/m)?.[1] ?? '未命名条目',
      source: parsed.data['source'] ?? '未标注来源',
      summary: parsed.content,
      extension: parsed.data['extension'] ?? '',
      storyNodeIds: String(parsed.data['storyNodeIds'] ?? '').split(',').filter(Boolean),
      keywords: String(parsed.data['keywords'] ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    }
  })
}

export const writeCompiledKnowledge = async (): Promise<void> => {
  const entries = await compileMarkdownKnowledge('content/source/kunlun-notes.md')
  await writeFile('content/compiled/knowledge.json', JSON.stringify(entries, null, 2), 'utf8')
}
```

- [ ] **Step 5: Document the content authoring rules**

```md
# 内容整理格式

每个文化条目使用一个一级标题开始。
必须填写 `source`、`storyNodeIds`、`keywords`。
摘要和延伸分别用二级标题区分。
```

- [ ] **Step 6: Run compiler and tests**

Run: `npx tsx scripts/compile-knowledge.ts`
Expected: `content/compiled/knowledge.json` generated.

Run: `npx vitest run tests/unit/knowledgeRetriever.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add content scripts src/main/services/contentRepository.ts tests/unit/knowledgeRetriever.test.ts docs/content-format.md
git commit -m "feat: add markdown knowledge compilation pipeline"
```

## Task 4: Implement Story State, Attitude State, And Save/Resume

**Files:**

- Create: `src/main/services/storyEngine.ts`
- Create: `src/main/services/attitudeEngine.ts`
- Create: `src/main/services/saveRepository.ts`
- Create: `src/renderer/stores/game.ts`
- Create: `src/renderer/stores/settings.ts`
- Test: `tests/unit/attitudeEngine.test.ts`
- Test: `tests/unit/storyEngine.test.ts`

- [ ] **Step 1: Write the failing attitude test**

```ts
import { describe, expect, it } from 'vitest'
import { applyAttitudeChoice } from '../../src/main/services/attitudeEngine'

describe('applyAttitudeChoice', () => {
  it('moves score up or down without changing story progression', () => {
    expect(applyAttitudeChoice(0, 'agree')).toBe(1)
    expect(applyAttitudeChoice(0, 'rebel')).toBe(-1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/attitudeEngine.test.ts`
Expected: FAIL because the engine does not exist.

- [ ] **Step 3: Implement the attitude engine**

```ts
export type AttitudeChoice = 'agree' | 'rebel'

export const applyAttitudeChoice = (currentScore: number, choice: AttitudeChoice): number => {
  const delta = choice === 'agree' ? 1 : -1
  return Math.max(-5, Math.min(5, currentScore + delta))
}
```

- [ ] **Step 4: Implement story progression and save shape**

```ts
export interface SaveState {
  currentNodeId: string
  roundIndex: number
  attitudeScore: number
  history: string[]
  bgmEnabled: boolean
}

export const createInitialSave = (): SaveState => ({
  currentNodeId: 'opening',
  roundIndex: 0,
  attitudeScore: 0,
  history: [],
  bgmEnabled: true
})
```

- [ ] **Step 5: Persist save data through Electron main process APIs**

```ts
import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const saveFilePath = join(app.getPath('userData'), 'save.json')

export const writeSave = async (state: SaveState): Promise<void> => {
  await mkdir(join(saveFilePath, '..'), { recursive: true })
  await writeFile(saveFilePath, JSON.stringify(state, null, 2), 'utf8')
}

export const readSave = async (): Promise<SaveState | null> => {
  try {
    const raw = await readFile(saveFilePath, 'utf8')
    return JSON.parse(raw) as SaveState
  } catch {
    return null
  }
}
```

- [ ] **Step 6: Run tests to verify the state layer passes**

Run: `npx vitest run tests/unit/attitudeEngine.test.ts tests/unit/storyEngine.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/services src/renderer/stores tests/unit/attitudeEngine.test.ts tests/unit/storyEngine.test.ts
git commit -m "feat: add story state attitude state and save flow"
```

## Task 5: Add Knowledge Retrieval And Prompt Assembly

**Files:**

- Create: `src/main/services/knowledgeRetriever.ts`
- Create: `src/main/services/promptBuilder.ts`
- Test: `tests/unit/knowledgeRetriever.test.ts`
- Test: `tests/unit/promptBuilder.test.ts`

- [ ] **Step 1: Write the failing prompt builder test**

```ts
import { describe, expect, it } from 'vitest'
import { buildPrompt } from '../../src/main/services/promptBuilder'

describe('buildPrompt', () => {
  it('includes node context, knowledge excerpts, and attitude style', () => {
    const prompt = buildPrompt({
      nodeTitle: '开场',
      attitudeScore: 2,
      knowledge: ['昆仑是神话源头意象']
    })

    expect(prompt).toContain('开场')
    expect(prompt).toContain('昆仑是神话源头意象')
    expect(prompt).toContain('风格')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/promptBuilder.test.ts`
Expected: FAIL because `buildPrompt` does not exist.

- [ ] **Step 3: Implement retrieval by story node and keyword overlap**

```ts
import type { KnowledgeEntry } from '../../shared/types/knowledge'

export const retrieveKnowledge = (
  entries: KnowledgeEntry[],
  nodeId: string,
  keywords: string[]
): KnowledgeEntry[] => {
  return entries
    .filter((entry) => entry.storyNodeIds.includes(nodeId) || entry.keywords.some((item) => keywords.includes(item)))
    .slice(0, 5)
}
```

- [ ] **Step 4: Implement prompt assembly with anti-spoiler and choice instructions**

```ts
export const buildPrompt = (input: {
  nodeTitle: string
  nodeSummary: string
  attitudeScore: number
  knowledge: string[]
}): string => {
  const style = input.attitudeScore >= 1 ? '偏可爱、亲近、会夸奖玩家' : input.attitudeScore <= -1 ? '偏傲娇、别扭、会轻微顶嘴' : '中性温和'

  return [
    `当前主线节点：${input.nodeTitle}`,
    `节点目标：${input.nodeSummary}`,
    `说话风格：${style}`,
    '必须只围绕当前节点说话，不允许剧透后续主线。',
    '回答结束后，生成两个上下文相关选项：一个附和型，一个反驳型。',
    `知识片段：${input.knowledge.join('\n')}`
  ].join('\n')
}
```

- [ ] **Step 5: Run tests to verify retrieval and prompt logic pass**

Run: `npx vitest run tests/unit/knowledgeRetriever.test.ts tests/unit/promptBuilder.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/services/knowledgeRetriever.ts src/main/services/promptBuilder.ts tests/unit/knowledgeRetriever.test.ts tests/unit/promptBuilder.test.ts
git commit -m "feat: add retrieval and prompt assembly"
```

## Task 6: Connect The OpenAI-Compatible Streaming Client

**Files:**

- Create: `src/main/services/openaiStreamClient.ts`
- Create: `src/shared/types/ai.ts`
- Create: `src/main/services/gameFacade.ts`

- [ ] **Step 1: Define the AI response contract**

```ts
export interface StreamChunk {
  type: 'text' | 'choices' | 'done' | 'error'
  text?: string
  choices?: { id: 'agree' | 'rebel'; label: string }[]
  message?: string
}
```

- [ ] **Step 2: Implement the OpenAI-compatible stream client**

```ts
import OpenAI from 'openai'

export const createStream = async (apiKey: string, baseURL: string, prompt: string) => {
  const client = new OpenAI({ apiKey, baseURL })

  return client.chat.completions.create({
    model: 'local-model',
    stream: true,
    messages: [{ role: 'user', content: prompt }]
  })
}
```

- [ ] **Step 3: Wrap streaming into a game-facing facade**

```ts
export const startDialogueRound = async (): Promise<AsyncGenerator<StreamChunk>> => {
  async function* generator() {
    yield { type: 'text', text: '...' }
    yield {
      type: 'choices',
      choices: [
        { id: 'agree', label: '我想继续听你说下去。' },
        { id: 'rebel', label: '你这样说我可不完全认同。' }
      ]
    }
    yield { type: 'done' }
  }

  return generator()
}
```

- [ ] **Step 4: Add environment-backed settings for base URL and model name**

```ts
export interface AiSettings {
  baseURL: string
  apiKey: string
  model: string
}
```

- [ ] **Step 5: Run a manual connectivity check**

Run: `pnpm dev`
Expected: app can issue a local request and stream partial text into the UI shell.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/openaiStreamClient.ts src/main/services/gameFacade.ts src/shared/types/ai.ts
git commit -m "feat: add openai compatible streaming client"
```

## Task 7: Build The Narrative UI And Streaming Experience

**Files:**

- Create: `src/renderer/components/GameShell.vue`
- Create: `src/renderer/components/DialogPanel.vue`
- Create: `src/renderer/components/ChoiceButtons.vue`
- Create: `src/renderer/components/BackgroundStage.vue`
- Create: `src/renderer/components/BgmPlayer.vue`
- Modify: `src/renderer/App.vue`
- Test: `tests/e2e/game-shell.spec.ts`

- [ ] **Step 1: Write the failing end-to-end shell test**

```ts
import { test, expect } from '@playwright/test'

test('shows streaming text and two choices', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('dialog-text')).toBeVisible()
  await expect(page.getByTestId('choice-agree')).toBeVisible()
  await expect(page.getByTestId('choice-rebel')).toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/game-shell.spec.ts`
Expected: FAIL because the UI components are not implemented.

- [ ] **Step 3: Implement the renderer shell**

```vue
<template>
  <GameShell />
</template>

<script setup lang="ts">
import GameShell from './components/GameShell.vue'
</script>
```

- [ ] **Step 4: Implement streaming dialog and dynamic choice buttons**

```vue
<template>
  <section>
    <p data-testid="dialog-text">{{ visibleText }}</p>
    <button data-testid="choice-agree">{{ agreeLabel }}</button>
    <button data-testid="choice-rebel">{{ rebelLabel }}</button>
  </section>
</template>
```

- [ ] **Step 5: Implement background transition and BGM mount points**

```vue
<template>
  <div class="background-stage" :style="backgroundStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ backgroundKey: string }>()
const backgroundStyle = computed(() => ({ backgroundImage: `var(--scene-${props.backgroundKey})` }))
</script>
```

- [ ] **Step 6: Run end-to-end test to verify the shell works**

Run: `npx playwright test tests/e2e/game-shell.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer tests/e2e/game-shell.spec.ts
git commit -m "feat: build streaming narrative ui"
```

## Task 8: Add Failure States, Retry Flow, And Content Handoff Docs

**Files:**

- Modify: `src/main/services/gameFacade.ts`
- Modify: `src/renderer/components/GameShell.vue`
- Modify: `src/renderer/components/DialogPanel.vue`
- Create: `tests/unit/gameFacade.test.ts`
- Create: `tests/helpers/collectStream.ts`
- Modify: `docs/content-format.md`

- [ ] **Step 1: Write the failing retry test**

```ts
import { describe, expect, it } from 'vitest'
import { collectStream } from '../helpers/collectStream'
import { createFailedRound } from '../../src/main/services/gameFacade'

describe('game facade retry', () => {
  it('returns an error chunk and allows retry when ai call fails', async () => {
    const chunks = await collectStream(createFailedRound(new Error('offline')))

    expect(chunks).toContainEqual({
      type: 'error',
      message: '当前模型不可用，请重试。'
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails for the right reason**

Run: `npx vitest run tests/unit/gameFacade.test.ts`
Expected: FAIL because `createFailedRound` does not exist yet.

- [ ] **Step 3: Add retry and error chunks in the game facade**

```ts
try {
  return stream
} catch (error) {
  return (async function* () {
    yield { type: 'error', message: '当前模型不可用，请重试。' }
  })()
}
```

- [ ] **Step 4: Surface retry actions in the renderer**

```vue
<template>
  <button v-if="hasError" @click="retryRound">重试本轮</button>
</template>
```

- [ ] **Step 5: Verify the full acceptance slice**

Run: `npx vitest run`
Expected: PASS

Run: `npx playwright test`
Expected: PASS

Run: `pnpm dev`
Expected: desktop app can stream dialogue, generate two contextual options, preserve progress, and show retry UI on failure.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/gameFacade.ts src/renderer/components/GameShell.vue src/renderer/components/DialogPanel.vue docs/content-format.md
git commit -m "feat: add retry flow and content handoff docs"
```

## Task 9: Prepare The First Content Delivery Package

**Files:**

- Modify: `content/source/kunlun-notes.md`
- Modify: `src/shared/config/storyNodes.json`
- Modify: `content/compiled/knowledge.json`
- Modify: `docs/content-format.md`

- [ ] **Step 1: Fill the first playable content package**

```md
# 条目：昆仑

source: 《山海经》与昆仑神话整理笔记
storyNodeIds: opening
keywords: 昆仑, 神话, 源头

## 摘要
昆仑在中国神话叙事中经常被视作通向神圣秩序的高地，也是理解“文明源头”想象的重要入口。

## 延伸
可延伸到西王母、神山意象、天地秩序与文化记忆如何在后世文献中被反复重述。
```

- [ ] **Step 2: Add at least 5 story nodes worth of configuration**

```json
[
  {
    "id": "opening",
    "title": "开场",
    "theme": "昆仑与源头",
    "summary": "引导玩家进入对话。",
    "retrievalKeywords": ["昆仑", "源头"],
    "backgroundMode": "fictional",
    "backgroundHint": "mountain-dawn",
    "toneHint": "mysterious",
    "nextNodeId": "memory-of-ancients"
  },
  {
    "id": "memory-of-ancients",
    "title": "上古回响",
    "theme": "三皇五帝与文明记忆",
    "summary": "把歌词里的上古意象和文化记忆对应起来。",
    "retrievalKeywords": ["三皇", "五帝", "上古"],
    "backgroundMode": "composite",
    "backgroundHint": "ancient-hall",
    "toneHint": "solemn",
    "nextNodeId": "rites-and-music"
  },
  {
    "id": "rites-and-music",
    "title": "礼乐初成",
    "theme": "礼乐与封神秩序",
    "summary": "说明礼乐、制度与神话叙事如何交织。",
    "retrievalKeywords": ["礼乐", "封神", "制度"],
    "backgroundMode": "photographic",
    "backgroundHint": "bronze-ritual",
    "toneHint": "measured",
    "nextNodeId": "hundred-schools"
  },
  {
    "id": "hundred-schools",
    "title": "百家争鸣",
    "theme": "诸子百家与文脉分流",
    "summary": "把礼崩乐坏后的思想生长接到歌词脉络上。",
    "retrievalKeywords": ["诸子百家", "文脉", "思想"],
    "backgroundMode": "photographic",
    "backgroundHint": "bamboo-library",
    "toneHint": "lively",
    "nextNodeId": "rebirth"
  },
  {
    "id": "rebirth",
    "title": "百年涅槃",
    "theme": "近现代震荡与归来",
    "summary": "把文化断裂、重整与归来收束到结尾节点。",
    "retrievalKeywords": ["涅槃", "归来", "近现代"],
    "backgroundMode": "composite",
    "backgroundHint": "sunrise-return",
    "toneHint": "uplifting",
    "nextNodeId": null
  }
]
```

- [ ] **Step 3: Recompile the knowledge base**

Run: `npx tsx scripts/compile-knowledge.ts`
Expected: `content/compiled/knowledge.json` updated with playable content.

- [ ] **Step 4: Smoke test the five-minute loop manually**

Run: `npm run dev`
Expected: one continuous session can cover at least 5 minutes of guided content without dead ends or obvious topic repetition, and each node's background choice clearly supports whether the content is mythic, documentary-cultural, or transitional.

- [ ] **Step 5: Commit**

```bash
git add content src/shared/config/storyNodes.json docs/content-format.md
git commit -m "feat: add first playable kunlun content package"
```

## Verification Checklist

- [ ] `pnpm install`
- [ ] `npx vitest run`
- [ ] `npx playwright test`
- [ ] `pnpm dev`
- [ ] Manual check: streaming output appears progressively rather than all at once.
- [ ] Manual check: both buttons are contextual, not static labels.
- [ ] Manual check: choosing different tones changes style but does not fork the storyline.
- [ ] Manual check: save file restores the current node and attitude score.

## Risks To Watch

1. If the local OpenAI-compatible service streams in a nonstandard way, the stream client may need an adapter layer before UI work is stable.
2. If Markdown content is too loose, retrieval quality will drop fast. Enforce the content format early.
3. If the first content package is too short, the UI can look complete while the product still misses the 5-minute target.

## Recommended Execution Order

1. Finish Tasks 1 through 5 before integrating the real model.
2. Finish Task 7 before polishing background art and BGM.
3. Treat Task 9 as a content milestone, not a cosmetic follow-up.
