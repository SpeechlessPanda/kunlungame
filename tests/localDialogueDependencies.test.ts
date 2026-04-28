import { describe, expect, it } from 'vitest'
import { createLocalDialogueDependencies, formatStoryPrompt, streamLocalLlamaText } from '../src/modeling/localDialogueDependencies.js'

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

describe('formatStoryPrompt', () => {
    it('joins system and user sections with the "System:"/"User:" headers the local llama expects', () => {
        const text = formatStoryPrompt({
            system: '你是昆仑谣的文化陪伴者。',
            user: '讲讲昆仑作为文明坐标的意义。'
        })

        expect(text).toBe(
            [
                'System:',
                '你是昆仑谣的文化陪伴者。',
                '',
                'User:',
                '讲讲昆仑作为文明坐标的意义。'
            ].join('\n')
        )
    })

    it('does not crash on empty system / user strings and keeps the header layout stable', () => {
        const text = formatStoryPrompt({ system: '', user: '' })
        expect(text).toBe(['System:', '', '', 'User:', ''].join('\n'))
    })
})

describe('streamLocalLlamaText · 边界分支', () => {
    it('does NOT retry when the first attempt already emitted chunks, and surfaces the late error', async () => {
        let attemptCount = 0

        const iterate = async () => {
            for await (const _chunk of streamLocalLlamaText(
                {
                    prompt: {
                        system: 'sys',
                        user: 'user'
                    },
                    modelPath: 'D:/models/qwen.gguf',
                    maxRetries: 2
                },
                {
                    createSession: async () => {
                        attemptCount += 1
                        return {
                            prompt: async (_prompt, options) => {
                                options.onTextChunk?.('半句。')
                                throw new Error('late network drop')
                            },
                            dispose: async () => undefined
                        }
                    }
                }
            )) {
                // 消费流
            }
        }

        await expect(iterate()).rejects.toThrow('late network drop')
        // 已经输出过 chunk 的尝试不应该再被重试。
        expect(attemptCount).toBe(1)
    })

    it('ignores zero-length chunks and only yields non-empty text', async () => {
        const chunks: string[] = []
        for await (const chunk of streamLocalLlamaText(
            {
                prompt: {
                    system: 'sys',
                    user: 'user'
                },
                modelPath: 'D:/models/qwen.gguf'
            },
            {
                createSession: async () => ({
                    prompt: async (_prompt, options) => {
                        options.onTextChunk?.('')
                        options.onTextChunk?.('真实内容。')
                        options.onTextChunk?.('')
                        return '真实内容。'
                    },
                    dispose: async () => undefined
                })
            }
        )) {
            chunks.push(chunk)
        }

        expect(chunks).toEqual(['真实内容。'])
    })

    it('always disposes the session even when the consumer breaks out of the stream early', async () => {
        let disposeCount = 0
        const iterator = streamLocalLlamaText(
            {
                prompt: {
                    system: 'sys',
                    user: 'user'
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
                    dispose: async () => {
                        disposeCount += 1
                    }
                })
            }
        )

        const { value } = await iterator.next()
        expect(value).toBe('第一段。')
        await iterator.return?.(undefined)
        expect(disposeCount).toBe(1)
    })

    it('routes system prompt to createSession (ChatML system role) and only user text to session.prompt', async () => {
        // 回归 2026-04 缺陷：早期实现把 system+user 拼成一段塞进 user 消息，
        // 导致 Qwen2.5 跳过 ChatML system 模板，人格只生效一两句就漂走。
        let capturedSystem: string | undefined
        let capturedUserPrompt: string | undefined

        for await (const _chunk of streamLocalLlamaText(
            {
                prompt: {
                    system: '你是昆仑子，亲切的文化引路人。',
                    user: '请用 30 字开场介绍昆仑。'
                },
                modelPath: 'D:/models/qwen.gguf'
            },
            {
                createSession: async (_modelPath, systemPrompt) => {
                    capturedSystem = systemPrompt
                    return {
                        prompt: async (userPrompt, options) => {
                            capturedUserPrompt = userPrompt
                            options.onTextChunk?.('好哒。')
                            return '好哒。'
                        },
                        dispose: async () => undefined
                    }
                }
            }
        )) {
            // consume
        }

        expect(capturedSystem).toBe('你是昆仑子，亲切的文化引路人。')
        expect(capturedUserPrompt).toBe('请用 30 字开场介绍昆仑。')
        // 关键反向断言：用户文本里不应该再看到 "System:" / 系统人格泄露。
        expect(capturedUserPrompt).not.toContain('System:')
        expect(capturedUserPrompt).not.toContain('文化引路人')
    })
})