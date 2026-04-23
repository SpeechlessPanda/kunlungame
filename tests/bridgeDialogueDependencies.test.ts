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
    settings: { bgmEnabled: true },
    isCompleted: false
}

const buildBridge = (result: DesktopMainlineTurnResult): Pick<DesktopBridge, 'runMainlineTurn'> & {
    runMainlineTurn: ReturnType<typeof vi.fn>
} => {
    return { runMainlineTurn: vi.fn().mockResolvedValue(result) }
}

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
        const deps = factory({
            node,
            runtimeState,
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
            streamed.push(chunk)
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
})
