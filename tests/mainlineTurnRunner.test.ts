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
})
