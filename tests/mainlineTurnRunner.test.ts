import { describe, expect, it } from 'vitest'
import { runMainlineTurn } from '../src/modeling/mainlineTurnRunner.js'
import { mainlineStoryOutline } from '../src/content/source/mainlineOutline.js'
import { createDefaultRuntimeState } from '../src/runtime/runtimeState.js'

const bootstrapInput = {
    preferredMode: 'default' as const,
    availableGpuVramGb: null,
    isPackaged: false,
    projectRoot: 'D:/project/kunlungame',
    appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
}

describe('runMainlineTurn', () => {
    it('drives a non-first canonical node end-to-end with injected dependencies', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        runtimeState.currentNodeId = 'creation-myths'
        runtimeState.turnIndex = 2
        runtimeState.readNodeIds = ['kunlun-threshold']

        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'creation-myths',
                attitudeChoiceMode: 'challenge',
                runtimeState,
                recentTurns: ['第一回合摘要：进入了昆仑之门。']
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [
                    {
                        id: 'myth-pangu',
                        topic: 'myth-origin',
                        source: 'src/content/generated/knowledgeEntries.json#盘古',
                        summary: '盘古开天辟地。',
                        extension: '中国最早的创世神话之一。',
                        storyNodeIds: ['creation-myths'],
                        keywords: ['盘古', '创世']
                    }
                ],
                createDialogueDependencies: () => ({
                    streamText: async function* () {
                        yield '盘古执斧，'
                        yield '天清地浊自此分明。'
                    },
                    generateOptions: async () => [
                        { semantic: 'align', label: '让我顺着这条脉络再听。' },
                        { semantic: 'challenge', label: '神话替代不了考古证据。' }
                    ]
                })
            }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.currentNodeId).toBe('creation-myths')
        expect(result.chunks).toEqual(['盘古执斧，', '天清地浊自此分明。'])
        expect(result.combinedText).toBe('盘古执斧，天清地浊自此分明。')
        expect(result.options.map((o) => o.semantic)).toEqual(['align', 'challenge'])
        expect(result.completed).toBe(true)
        expect(result.modelPath).toMatch(/qwen2.5/)
    })

    it('returns ok=false with reason=model-missing when the GGUF file is not on disk', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => false,
                readKnowledgeEntries: async () => {
                    throw new Error('should not reach knowledge read when model missing')
                },
                createDialogueDependencies: () => {
                    throw new Error('should not reach dependency creation when model missing')
                }
            }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.reason).toBe('model-missing')
        expect(result.modelPath).toBeDefined()
    })

    it('returns ok=false with reason=node-missing for an unknown node id', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'no-such-node',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [],
                createDialogueDependencies: () => {
                    throw new Error('should not reach')
                }
            }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.reason).toBe('node-missing')
    })

    it('returns ok=false with reason=model-load-failed when dependency creation throws', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [],
                createDialogueDependencies: () => {
                    throw new Error('llama init failed')
                }
            }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.reason).toBe('model-load-failed')
        expect(result.message).toContain('llama init failed')
    })

    it('returns ok=false with reason=orchestration-failed when streamText throws', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [],
                createDialogueDependencies: () => ({
                    streamText: async function* () {
                        throw new Error('stream exploded mid-generation')
                    },
                    generateOptions: async () => []
                })
            }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.reason).toBe('orchestration-failed')
        expect(result.message).toContain('stream exploded')
    })

    it('feeds a different RAG card window into the prompt as turnsInCurrentNode changes', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const prompts: string[] = []
        const readKnowledgeEntries = async () => [
            {
                id: 'rag-a',
                topic: 'myth-origin',
                source: 'docs/knowledge-base/cultural-knowledge.md#A',
                summary: 'A 号知识',
                extension: '- A 事实',
                storyNodeIds: ['kunlun-threshold'],
                keywords: ['昆仑']
            },
            {
                id: 'rag-b',
                topic: 'myth-origin',
                source: 'docs/knowledge-base/cultural-knowledge.md#B',
                summary: 'B 号知识',
                extension: '- B 事实',
                storyNodeIds: ['kunlun-threshold'],
                keywords: ['昆仑']
            },
            {
                id: 'rag-c',
                topic: 'myth-origin',
                source: 'docs/knowledge-base/cultural-knowledge.md#C',
                summary: 'C 号知识',
                extension: '- C 事实',
                storyNodeIds: ['kunlun-threshold'],
                keywords: ['昆仑']
            },
            {
                id: 'rag-d',
                topic: 'myth-origin',
                source: 'docs/knowledge-base/cultural-knowledge.md#D',
                summary: 'D 号知识',
                extension: '- D 事实',
                storyNodeIds: ['kunlun-threshold'],
                keywords: ['昆仑']
            }
        ]
        const createDialogueDependencies = () => ({
            streamText: async function* (prompt: { user: string }) {
                prompts.push(prompt.user)
                yield '这一轮由 RAG 组织。'
            },
            generateOptions: async () => [
                { semantic: 'align' as const, label: '继续听。' },
                { semantic: 'challenge' as const, label: '先追问。' }
            ]
        })

        await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState: { ...runtimeState, turnsInCurrentNode: 0 },
                recentTurns: []
            },
            { checkFileExists: async () => true, readKnowledgeEntries, createDialogueDependencies }
        )
        await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState: { ...runtimeState, turnsInCurrentNode: 1 },
                recentTurns: []
            },
            { checkFileExists: async () => true, readKnowledgeEntries, createDialogueDependencies }
        )

        const initialPrompts = prompts.filter((prompt) => prompt.includes('# 可用的知识条目'))
        expect(initialPrompts).toHaveLength(2)
        expect(initialPrompts[0]).toContain('RAG-K1 · A 号知识')
        expect(initialPrompts[0]).toContain('RAG-K2 · B 号知识')
        expect(initialPrompts[1]).toContain('RAG-K1 · B 号知识')
        expect(initialPrompts[1]).toContain('RAG-K2 · C 号知识')
        expect(initialPrompts[0]).not.toBe(initialPrompts[1])
    })

    it('returns UI chunks after current-node boundary cleanup', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [
                    {
                        id: 'kunlun-axis',
                        topic: 'myth-origin',
                        source: 'docs/knowledge-base/cultural-knowledge.md#昆仑',
                        summary: '昆仑是天人之轴。',
                        extension: '《山海经》把昆仑写成天帝在人间的都城。',
                        storyNodeIds: ['kunlun-threshold'],
                        keywords: ['昆仑', '天柱']
                    }
                ],
                createDialogueDependencies: () => ({
                    streamText: async function* () {
                        yield '昆仑在古人心中是天柱，也是天与地之间的纽带。'
                        yield '盘古开天辟地前的世界混沌一片。'
                        yield '我对上几个节点描述了许多历史人物。'
                        yield '所以你愿意先从昆仑为什么成为起点想起吗？'
                    },
                    generateOptions: async () => [
                        { semantic: 'align' as const, label: '继续听。' },
                        { semantic: 'challenge' as const, label: '先追问。' }
                    ]
                })
            }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.combinedText).toContain('昆仑在古人心中是天柱')
        expect(result.combinedText).toContain('昆仑为什么成为起点')
        expect(result.combinedText).not.toContain('盘古')
        expect(result.combinedText).not.toContain('上几个节点')
        expect(result.chunks.join('')).toBe(result.combinedText)
    })

    it('emits long model text through stream callbacks in incremental chunks', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        const streamed: string[] = []
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [],
                createDialogueDependencies: () => ({
                    streamText: async function* () {
                        yield '昆仑在古人心中是世界中心也是天柱想象的起点'
                        yield '，它把山川地理和天帝都城的神话连在一起。'
                    },
                    generateOptions: async () => [
                        { semantic: 'align' as const, label: '继续听。' },
                        { semantic: 'challenge' as const, label: '先追问。' }
                    ]
                })
            },
            { onChunk: (text) => streamed.push(text) }
        )

        expect(result.ok).toBe(true)
        expect(streamed.length).toBeGreaterThan(2)
        expect(streamed.join('')).toContain('昆仑在古人心中')
    })

    it('repairs short low-coverage model output with a second AI pass', async () => {
        const runtimeState = createDefaultRuntimeState(mainlineStoryOutline)
        let streamCalls = 0
        const result = await runMainlineTurn(
            {
                ...bootstrapInput,
                nodeId: 'kunlun-threshold',
                attitudeChoiceMode: 'align',
                runtimeState,
                recentTurns: []
            },
            {
                checkFileExists: async () => true,
                readKnowledgeEntries: async () => [
                    {
                        id: 'kunlun-axis',
                        topic: 'myth-origin',
                        source: 'docs/knowledge-base/cultural-knowledge.md#昆仑',
                        summary: '昆仑是世界中心与天柱。',
                        extension: '《山海经》把昆仑写成天帝在人间的都城，分樊桐、玄圃、阆风三层。',
                        storyNodeIds: ['kunlun-threshold'],
                        keywords: ['昆仑', '天柱', '山海经']
                    }
                ],
                createDialogueDependencies: () => ({
                    streamText: async function* () {
                        streamCalls += 1
                        if (streamCalls === 1) {
                            yield '昆仑很重要。你想继续听吗？'
                            return
                        }
                        yield '诶呀，先别急着往后跑。昆仑在古人心中是世界中心，也是撑起天地想象的天柱。'
                        yield '《山海经》把它写成天帝在人间的都城，樊桐、玄圃、阆风像三层通向天上的庭院。'
                        yield '西王母的形象也在这里反复变化，从远古神格到汉代仙界主母，说明昆仑一直被后人重新理解和改写。'
                        yield '所以我们从昆仑开始，是把神话、地理和身份这三条线先接起来，你愿意顺着这条线再看深一点吗？'
                    },
                    generateOptions: async () => [
                        { semantic: 'align' as const, label: '继续听。' },
                        { semantic: 'challenge' as const, label: '先追问。' }
                    ]
                })
            }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(streamCalls).toBe(2)
        expect(result.combinedText).toContain('世界中心')
        expect(result.combinedText).toContain('山海经')
        expect(result.combinedText).toContain('西王母')
        expect(result.combinedText.length).toBeGreaterThan(160)
    })
})
