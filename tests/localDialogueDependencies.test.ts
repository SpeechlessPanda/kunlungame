import { describe, expect, it } from 'vitest'
import { createLocalDialogueDependencies, streamLocalLlamaText } from '../src/modeling/localDialogueDependencies.js'

describe('streamLocalLlamaText', () => {
    it('yields streamed chunks from the local llama session in order', async () => {
        const chunks = []

        for await (const chunk of streamLocalLlamaText(
            {
                prompt: {
                    system: '你是《昆仑谣》的文化陪伴者。',
                    user: '请用中文介绍昆仑。'
                },
                modelPath: 'D:/models/qwen.gguf'
            },
            {
                createSession: async () => ({
                    prompt: async (_prompt, options) => {
                        options.onTextChunk?.('第一段。')
                        options.onTextChunk?.('第二段。')
                        return '第一段。第二段。'
                    },
                    dispose: async () => undefined
                })
            }
        )) {
            chunks.push(chunk)
        }

        expect(chunks).toEqual(['第一段。', '第二段。'])
    })

    it('retries once when the first stream attempt fails before any chunk is emitted', async () => {
        let attemptCount = 0
        const chunks = []

        for await (const chunk of streamLocalLlamaText(
            {
                prompt: {
                    system: '你是《昆仑谣》的文化陪伴者。',
                    user: '请用中文介绍昆仑。'
                },
                modelPath: 'D:/models/qwen.gguf',
                maxRetries: 1
            },
            {
                createSession: async () => {
                    attemptCount += 1

                    return {
                        prompt: async (_prompt, options) => {
                            if (attemptCount === 1) {
                                throw new Error('temporary backend disconnect')
                            }

                            options.onTextChunk?.('恢复成功。')
                            return '恢复成功。'
                        },
                        dispose: async () => undefined
                    }
                }
            }
        )) {
            chunks.push(chunk)
        }

        expect(attemptCount).toBe(2)
        expect(chunks).toEqual(['恢复成功。'])
    })

    it('surfaces the stream failure when a retry budget is exhausted', async () => {
        const iterate = async () => {
            for await (const _chunk of streamLocalLlamaText(
                {
                    prompt: {
                        system: '你是《昆仑谣》的文化陪伴者。',
                        user: '请用中文介绍昆仑。'
                    },
                    modelPath: 'D:/models/qwen.gguf',
                    maxRetries: 1
                },
                {
                    createSession: async () => ({
                        prompt: async () => {
                            throw new Error('persistent backend disconnect')
                        },
                        dispose: async () => undefined
                    })
                }
            )) {
                // consume the stream
            }
        }

        await expect(iterate()).rejects.toThrow('persistent backend disconnect')
    })
})

describe('createLocalDialogueDependencies', () => {
    it('wires the local llama stream into dialogue dependencies without changing option generation', async () => {
        const dependencies = createLocalDialogueDependencies(
            {
                modelPath: 'D:/models/qwen.gguf',
                maxRetries: 1,
                generateOptions: async () => [
                    {
                        semantic: 'align',
                        label: '继续听'
                    },
                    {
                        semantic: 'challenge',
                        label: '我有疑问'
                    }
                ]
            },
            {
                createSession: async () => ({
                    prompt: async (_prompt, options) => {
                        options.onTextChunk?.('昆仑开场。')
                        return '昆仑开场。'
                    },
                    dispose: async () => undefined
                })
            }
        )

        const streamChunks = []
        for await (const chunk of dependencies.streamText({
            system: 'system rules',
            user: 'user prompt'
        })) {
            streamChunks.push(chunk)
        }

        const options = await dependencies.generateOptions({
            currentNode: {
                id: 'kunlun-threshold',
                title: '昆仑初问',
                era: 'myth-origin',
                theme: '文明原点',
                coreQuestion: '我们为什么从昆仑开始回望自己？',
                summary: '现代青年从昆仑入口重新辨认中国文明最初的精神坐标。',
                mustIncludeFacts: ['昆仑被视为世界中心'],
                retrievalKeywords: ['昆仑'],
                recommendedFigures: ['西王母'],
                allowedKnowledgeTopics: ['myth-origin'],
                forbiddenFutureTopics: ['civilization-origin'],
                backgroundMode: 'fictional',
                backgroundHint: '雪山云海。',
                toneHint: '庄严。',
                characterCueIds: ['guide.kunlun'],
                minTurns: 1,
                nextNodeId: 'creation-myths'
            },
            semantics: ['align', 'challenge']
        })

        expect(streamChunks).toEqual(['昆仑开场。'])
        expect(options).toEqual([
            {
                semantic: 'align',
                label: '继续听'
            },
            {
                semantic: 'challenge',
                label: '我有疑问'
            }
        ])
    })
})