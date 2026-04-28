import { describe, expect, it, vi } from 'vitest'
import type {
    DialogueDependencies,
    DialogueOption
} from '../src/modeling/dialogueOrchestrator.js'
import type { PlayerAttitudeChoice, RuntimeState } from '../src/runtime/runtimeState.js'
import { SAVE_VERSION } from '../src/runtime/runtimeState.js'
import { minimalStoryOutline } from '../src/shared/contracts/contentContracts.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { createTurnController } from '../src/renderer/composables/useTurnController.js'
import { createDialogueSession } from '../src/renderer/composables/useDialogueSession.js'
import { buildMockDialogueDependencies } from '../src/renderer/adapters/rendererDialogueDependencies.js'

const node = minimalStoryOutline.nodes[0]!

const runtimeState: RuntimeState = {
    saveVersion: SAVE_VERSION,
    currentNodeId: node.id,
    turnIndex: 0,
    turnsInCurrentNode: 0,
    attitudeScore: 0,
    historySummary: '尚未展开任何对话。',
    readNodeIds: [],
    settings: {
        bgmEnabled: true,
        preferredModelMode: 'default',
        modelProvider: 'openai-compatible',
        openAiCompatible: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            fallbackModels: []
        }
    },
    isCompleted: false
}

const buildSession = (dependencies: DialogueDependencies) => {
    return createDialogueSession({
        dependenciesFactory: () => dependencies,
        scheduleReveal: () => {
            // 测试里不跑真实 setInterval；直接让 reveal 在 skipReveal() 里一次到底。
        }
    })
}

describe('useDialogueSession', () => {
    it('routes chunk/options/complete events into the turn controller and advances state to awaiting-choice', async () => {
        const chunks = ['第一段。', '第二段。']
        const options: DialogueOption[] = [
            { semantic: 'align', label: '同意这条路径。' },
            { semantic: 'challenge', label: '质疑这条路径。' }
        ]
        const deps: DialogueDependencies = {
            streamText: async function* () {
                for (const chunk of chunks) {
                    yield chunk
                }
            },
            generateOptions: async () => options
        }

        const controller = createTurnController()
        const session = buildSession(deps)

        await session.runTurn(
            {
                node,
                runtimeState,
                retrievedEntries: [],
                attitudeChoiceMode: 'align',
                recentTurns: []
            },
            controller
        )

        expect(controller.view.value.fullText).toBe('第一段。第二段。')
        expect(controller.view.value.snapshot.state).toBe('awaiting-choice')
        expect(controller.view.value.choices).toEqual([
            { id: 'align', label: '同意这条路径。' },
            { id: 'challenge', label: '质疑这条路径。' }
        ])
        expect(session.lastOptions.value).toEqual(options)
    })

    it('routes error events into the turn controller without throwing', async () => {
        const deps: DialogueDependencies = {
            streamText: async function* () {
                throw new Error('模型暂时不可用。')
            },
            generateOptions: async () => []
        }

        const controller = createTurnController()
        const session = buildSession(deps)

        await session.runTurn(
            {
                node,
                runtimeState,
                retrievedEntries: [],
                attitudeChoiceMode: 'align',
                recentTurns: []
            },
            controller
        )

        expect(controller.view.value.snapshot.state).toBe('error')
        expect(controller.view.value.snapshot.errorMessage).toBe('模型暂时不可用。')
        expect(controller.view.value.snapshot.canRetry).toBe(true)
    })

    it('clears streamed draft text when a reset event arrives', async () => {
        const deps: DialogueDependencies = {
            streamText: async function* () {
                yield '短答。'
                yield { type: 'reset' as const }
                yield '修复后的正文。'
            },
            generateOptions: async () => [
                { semantic: 'align', label: '继续。' },
                { semantic: 'challenge', label: '追问。' }
            ]
        }

        const controller = createTurnController()
        const session = buildSession(deps)
        await session.runTurn({ node, runtimeState, retrievedEntries: [], attitudeChoiceMode: 'align', recentTurns: [] }, controller)

        expect(controller.view.value.fullText).toBe('修复后的正文。')
        expect(controller.view.value.fullText).not.toContain('短答')
        expect(controller.view.value.snapshot.state).toBe('awaiting-choice')
    })

    it('starts reveal scheduling as soon as the first chunk arrives', async () => {
        const scheduleReveal = vi.fn()
        const deps: DialogueDependencies = {
            streamText: async function* () {
                yield '第一段正在流入。'
            },
            generateOptions: async () => [
                { semantic: 'align', label: '继续。' },
                { semantic: 'challenge', label: '追问。' }
            ]
        }
        const session = createDialogueSession({ dependenciesFactory: () => deps, scheduleReveal })
        const controller = createTurnController()

        await session.runTurn({ node, runtimeState, retrievedEntries: [], attitudeChoiceMode: 'align', recentTurns: [] }, controller)

        expect(scheduleReveal).toHaveBeenCalledTimes(1)
    })

    it('cancels an in-flight turn so later events are ignored by the controller', async () => {
        let resume!: () => void
        const gate = new Promise<void>((resolve) => {
            resume = resolve
        })
        const deps: DialogueDependencies = {
            streamText: async function* () {
                yield '先发一段。'
                await gate
                yield '被取消后的段。'
            },
            generateOptions: async () => [
                { semantic: 'align', label: 'a' },
                { semantic: 'challenge', label: 'b' }
            ]
        }

        const controller = createTurnController()
        const session = buildSession(deps)

        const pending = session.runTurn(
            {
                node,
                runtimeState,
                retrievedEntries: [],
                attitudeChoiceMode: 'align',
                recentTurns: []
            },
            controller
        )

        // 让第一个 chunk 被消费
        await Promise.resolve()
        await Promise.resolve()

        session.cancel()
        resume()
        await pending

        expect(controller.view.value.fullText.includes('被取消后的段')).toBe(false)
        expect(controller.view.value.snapshot.state).not.toBe('awaiting-choice')
    })

    it('lets setDependenciesFactory swap the dependency source between turns', async () => {
        const deps1: DialogueDependencies = {
            streamText: async function* () {
                yield '第一次流。'
            },
            generateOptions: async () => [
                { semantic: 'align', label: '一同意' },
                { semantic: 'challenge', label: '一反驳' }
            ]
        }
        const deps2: DialogueDependencies = {
            streamText: async function* () {
                yield '第二次流。'
            },
            generateOptions: async () => [
                { semantic: 'align', label: '二同意' },
                { semantic: 'challenge', label: '二反驳' }
            ]
        }

        const session = createDialogueSession({
            dependenciesFactory: () => deps1,
            scheduleReveal: () => undefined
        })

        const controller = createTurnController()
        await session.runTurn(
            {
                node,
                runtimeState,
                retrievedEntries: [],
                attitudeChoiceMode: 'align',
                recentTurns: []
            },
            controller
        )
        expect(controller.view.value.fullText).toBe('第一次流。')

        session.setDependenciesFactory(() => deps2)
        const controller2 = createTurnController()
        await session.runTurn(
            {
                node,
                runtimeState,
                retrievedEntries: [],
                attitudeChoiceMode: 'challenge',
                recentTurns: []
            },
            controller2
        )
        expect(controller2.view.value.fullText).toBe('第二次流。')
        expect(controller2.view.value.choices.map((c) => c.label)).toEqual(['二同意', '二反驳'])
    })
})

describe('buildMockDialogueDependencies', () => {
    it('emits at least two distinct chunks and two mapped options for known nodes', async () => {
        const sleep = vi.fn(async () => undefined)
        const deps = buildMockDialogueDependencies(node, { sleep, chunkDelayMs: 1, optionsDelayMs: 1 })

        const collected: string[] = []
        for await (const chunk of deps.streamText({ system: '', user: '' })) {
            if (typeof chunk === 'string') collected.push(chunk)
        }
        expect(collected.length).toBeGreaterThanOrEqual(2)
        expect(new Set(collected).size).toBe(collected.length)

        const semantics: PlayerAttitudeChoice[] = ['align', 'challenge']
        const options = await deps.generateOptions({ currentNode: node, semantics })
        expect(options).toHaveLength(2)
        expect(options.map((o) => o.semantic)).toEqual(['align', 'challenge'])
        expect(options[0]!.label).not.toBe(options[1]!.label)
    })

    it('keeps preview align/challenge options on the same content anchor', async () => {
        for (const mainlineNode of mainlineStoryOutline.nodes) {
            const deps = buildMockDialogueDependencies(mainlineNode, { sleep: async () => undefined })
            const options = await deps.generateOptions({ currentNode: mainlineNode, semantics: ['align', 'challenge'] })
            const align = options.find((option) => option.semantic === 'align')!.label
            const challenge = options.find((option) => option.semantic === 'challenge')!.label

            const alignBigrams = new Set<string>()
            const alignChars = Array.from(align.replace(/[，。！？、——"“”\s]/gu, ''))
            for (let index = 0; index < alignChars.length - 1; index += 1) {
                alignBigrams.add(`${alignChars[index]}${alignChars[index + 1]}`)
            }
            const sharedTerms = [...alignBigrams].filter((term) => challenge.includes(term))
                .filter((term) => !['我也', '这条', '条线', '听但', '愿意'].includes(term))

            expect(sharedTerms.length, `${mainlineNode.id}: ${align} / ${challenge}`).toBeGreaterThanOrEqual(1)
            expect(align).toMatch(/原来|源远流长|脉络|听懂|接上|厚|长|回响|愿意|接受|感觉|理解/)
            expect(challenge).toMatch(/证据|质疑|合理|代价|可疑|追问|凭什么|说清/)
        }
    })
})
