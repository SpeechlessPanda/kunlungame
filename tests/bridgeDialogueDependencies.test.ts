import { describe, expect, it, vi } from 'vitest'
import { createBridgeDialogueDependenciesFactory } from '../src/renderer/adapters/rendererDialogueDependencies.js'
import { SAVE_VERSION } from '../src/runtime/runtimeState.js'
import type { RuntimeState } from '../src/runtime/runtimeState.js'
import { minimalStoryOutline } from '../src/shared/contracts/contentContracts.js'
import type {
    DesktopBridge,
    DesktopMainlineTurnResult
} from '../src/shared/types/desktop.js'

const node = minimalStoryOutline.nodes[0]!
const runtimeState: RuntimeState = {
    saveVersion: SAVE_VERSION,
    currentNodeId: node.id,
    turnIndex: 0,
    turnsInCurrentNode: 0,
    attitudeScore: 0,
    historySummary: '起点。',
    readNodeIds: [],
    settings: { bgmEnabled: true, preferredModelMode: 'default' },
    isCompleted: false
}

const buildBridge = (result: DesktopMainlineTurnResult): Pick<DesktopBridge, 'runMainlineTurn'> & {
    runMainlineTurn: ReturnType<typeof vi.fn>
} => {
    return { runMainlineTurn: vi.fn().mockResolvedValue(result) }
}

const buildStreamingBridge = (
    events: AsyncIterable<import('../src/shared/types/desktop.js').DesktopMainlineTurnStreamEvent>
): Pick<DesktopBridge, 'runMainlineTurn' | 'streamMainlineTurn'> & {
    runMainlineTurn: ReturnType<typeof vi.fn>
    streamMainlineTurn: ReturnType<typeof vi.fn>
} => ({
    runMainlineTurn: vi.fn(),
    streamMainlineTurn: vi.fn().mockReturnValue(events)
})

describe('createBridgeDialogueDependenciesFactory', () => {
    it('streams chunks and returns ordered align/challenge options via a single IPC call', async () => {
        const bridge = buildBridge({
            ok: true,
            selectedProfileId: 'qwen2.5-3b-instruct-q4km',
            modelPath: '/fake/path/model.gguf',
            currentNodeId: node.id,
            fallbackUsed: false,
            chunks: ['段落一。', '段落二。'],
            combinedText: '段落一。段落二。',
            options: [
                { semantic: 'challenge', label: '先质疑。' },
                { semantic: 'align', label: '先顺从。' }
            ],
            completed: true
        })

        const factory = createBridgeDialogueDependenciesFactory(bridge, {
            chunkDelayMs: 0,
            sleep: async () => { }
        })
        const ipcRuntimeState: RuntimeState = {
            ...runtimeState,
            turnsInCurrentNode: 2,
            isCompleted: true
        }
        const deps = factory({
            node,
            runtimeState: ipcRuntimeState,
            retrievedEntries: [],
            attitudeChoiceMode: 'align',
            recentTurns: ['前一回合摘要。']
        })

        const streamed: string[] = []
        for await (const chunk of deps.streamText({
            storyNode: node,
            retrievedEntries: [],
            runtimeState,
            attitudeChoiceMode: 'align',
            recentTurns: []
        } as never)) {
            if (typeof chunk === 'string') streamed.push(chunk)
        }
        expect(streamed).toEqual(['段落一。', '段落二。'])

        const options = await deps.generateOptions({
            semantics: ['align', 'challenge'],
            currentNode: node,
            retrievedEntries: [],
            runtimeState,
            attitudeChoiceMode: 'align',
            recentTurns: []
        } as never)
        expect(options.map((o) => o.label)).toEqual(['先顺从。', '先质疑。'])
        expect(bridge.runMainlineTurn).toHaveBeenCalledTimes(1)
        const call = bridge.runMainlineTurn.mock.calls[0]![0]
        expect(call.nodeId).toBe(node.id)
        expect(call.attitudeChoiceMode).toBe('align')
        expect(call.runtimeState.saveVersion).toBe(SAVE_VERSION)
        expect(call.runtimeState.turnsInCurrentNode).toBe(2)
        expect(call.runtimeState.isCompleted).toBe(true)
        expect(call.recentTurns).toEqual(['前一回合摘要。'])
    })

    it('surfaces bridge failures as thrown errors from streamText', async () => {
        const bridge = buildBridge({
            ok: false,
            reason: 'model-missing',
            message: '模型文件不存在。',
            modelPath: '/fake/model.gguf'
        })
        const factory = createBridgeDialogueDependenciesFactory(bridge, {
            chunkDelayMs: 0,
            sleep: async () => { }
        })
        const deps = factory({
            node,
            runtimeState,
            retrievedEntries: [],
            attitudeChoiceMode: 'align',
            recentTurns: []
        })

        await expect(async () => {
            for await (const _chunk of deps.streamText({} as never)) {
                void _chunk
            }
        }).rejects.toThrow(/model-missing/)
    })

    it('uses streamMainlineTurn when available and yields chunks before options are requested', async () => {
        async function* events() {
            yield { type: 'chunk' as const, text: '实时第一句。' }
            yield { type: 'chunk' as const, text: '实时第二句。' }
            yield {
                type: 'result' as const,
                result: {
                    ok: true as const,
                    selectedProfileId: 'qwen2.5-3b-instruct-q4km',
                    modelPath: '/fake/path/model.gguf',
                    currentNodeId: node.id,
                    fallbackUsed: false,
                    chunks: ['实时第一句。', '实时第二句。'],
                    combinedText: '实时第一句。实时第二句。',
                    options: [
                        { semantic: 'align' as const, label: '顺着听。' },
                        { semantic: 'challenge' as const, label: '先追问。' }
                    ],
                    completed: true
                }
            }
        }

        const bridge = buildStreamingBridge(events())
        const factory = createBridgeDialogueDependenciesFactory(bridge, {
            chunkDelayMs: 0,
            sleep: async () => { }
        })
        const deps = factory({
            node,
            runtimeState,
            retrievedEntries: [],
            attitudeChoiceMode: 'align',
            recentTurns: []
        })

        const streamed: string[] = []
        for await (const item of deps.streamText({} as never)) {
            if (typeof item === 'string') streamed.push(item)
        }
        expect(streamed).toEqual(['实时第一句。', '实时第二句。'])
        expect(bridge.streamMainlineTurn).toHaveBeenCalledTimes(1)
        expect(bridge.runMainlineTurn).not.toHaveBeenCalled()

        const options = await deps.generateOptions({ semantics: ['align', 'challenge'] } as never)
        expect(options.map((option) => option.label)).toEqual(['顺着听。', '先追问。'])
    })

    it('passes reset events through to the dialogue session layer', async () => {
        async function* events() {
            yield { type: 'chunk' as const, text: '短答。' }
            yield { type: 'reset' as const }
            yield { type: 'chunk' as const, text: '修复后的正文。' }
            yield {
                type: 'result' as const,
                result: {
                    ok: true as const,
                    selectedProfileId: 'qwen2.5-3b-instruct-q4km',
                    modelPath: '/fake/path/model.gguf',
                    currentNodeId: node.id,
                    fallbackUsed: false,
                    chunks: ['修复后的正文。'],
                    combinedText: '修复后的正文。',
                    options: [],
                    completed: true
                }
            }
        }
        const bridge = buildStreamingBridge(events())
        const factory = createBridgeDialogueDependenciesFactory(bridge, { chunkDelayMs: 0, sleep: async () => { } })
        const deps = factory({ node, runtimeState, retrievedEntries: [], attitudeChoiceMode: 'align', recentTurns: [] })

        const items: unknown[] = []
        for await (const item of deps.streamText({} as never)) items.push(item)
        expect(items).toEqual(['短答。', { type: 'reset' }, '修复后的正文。'])
    })
})
