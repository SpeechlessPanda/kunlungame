import { describe, expect, it } from 'vitest'
import { runDialogueSmokeTest } from '../src/modeling/dialogueSmokeTest.js'

describe('runDialogueSmokeTest', () => {
    it('collects a single-round dialogue smoke result from the current mainline node', async () => {
        const result = await runDialogueSmokeTest(
            {
                preferredMode: 'default',
                availableGpuVramGb: null,
                isPackaged: false,
                projectRoot: 'D:/project/kunlungame',
                appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
            },
            {
                readKnowledgeEntries: async () => [
                    {
                        id: 'myth-origin-01',
                        topic: 'myth-origin',
                        source: 'src/content/generated/knowledgeEntries.json#昆仑',
                        summary: '昆仑被视为世界中心。',
                        extension: '西王母形象见证昆仑文化的长期演化。',
                        storyNodeIds: ['kunlun-threshold'],
                        keywords: ['昆仑', '西王母']
                    }
                ],
                createDialogueDependencies: () => ({
                    streamText: async function* () {
                        yield '第一段。'
                        yield '第二段。'
                    },
                    generateOptions: async () => [
                        {
                            semantic: 'align',
                            label: '继续听'
                        },
                        {
                            semantic: 'challenge',
                            label: '先说理由'
                        }
                    ]
                })
            }
        )

        expect(result.selectedProfileId).toBe('qwen2.5-3b-instruct-q4km')
        expect(result.currentNodeId).toBe('kunlun-threshold')
        expect(result.chunkCount).toBe(2)
        expect(result.combinedText).toBe('第一段。第二段。')
        expect(result.combinedTextLength).toBe('第一段。第二段。'.length)
        expect(result.completed).toBe(true)
        expect(result.options).toHaveLength(2)
        expect(result.fallbackUsed).toBe(false)
    })

    it('throws when the orchestrator returns an error event', async () => {
        const run = async () => {
            await runDialogueSmokeTest(
                {
                    preferredMode: 'default',
                    availableGpuVramGb: null,
                    isPackaged: false,
                    projectRoot: 'D:/project/kunlungame',
                    appDataDir: 'C:/Users/test/AppData/Roaming/Kunlungame'
                },
                {
                    readKnowledgeEntries: async () => [],
                    createDialogueDependencies: () => ({
                        streamText: async function* () {
                            throw new Error('model stream interrupted')
                        },
                        generateOptions: async () => []
                    })
                }
            )
        }

        await expect(run()).rejects.toThrow('model stream interrupted')
    })
})