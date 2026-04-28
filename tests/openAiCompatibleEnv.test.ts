import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { loadOpenAiCompatibleEnv } from '../scripts/openAiCompatibleEnv.js'

describe('loadOpenAiCompatibleEnv', () => {
    it('loads API settings and fallback models from .env.local without requiring process env', async () => {
        const projectRoot = join(tmpdir(), `kunlun-env-${Date.now()}`)
        await mkdir(projectRoot, { recursive: true })
        await writeFile(join(projectRoot, '.env.local'), [
            'KUNLUN_OPENAI_API_KEY="sk-test-from-file"',
            'KUNLUN_OPENAI_BASE_URL=https://openrouter.ai/api/v1',
            'KUNLUN_OPENAI_MODEL=qwen/qwen3-next-80b-a3b-instruct:free',
            'KUNLUN_OPENAI_FALLBACK_MODELS=z-ai/glm-4.5-air:free, openai/gpt-oss-120b:free'
        ].join('\n'), 'utf8')

        try {
            const settings = await loadOpenAiCompatibleEnv(projectRoot, {})

            expect(settings).toEqual({
                apiKey: 'sk-test-from-file',
                baseUrl: 'https://openrouter.ai/api/v1',
                model: 'qwen/qwen3-next-80b-a3b-instruct:free',
                fallbackModels: ['z-ai/glm-4.5-air:free', 'openai/gpt-oss-120b:free']
            })
        } finally {
            await rm(projectRoot, { recursive: true, force: true })
        }
    })

    it('rejects a chat completions endpoint because scripts need the API root', async () => {
        await expect(loadOpenAiCompatibleEnv(process.cwd(), {
            KUNLUN_OPENAI_API_KEY: 'sk-test',
            KUNLUN_OPENAI_BASE_URL: 'https://openrouter.ai/api/v1/chat/completions',
            KUNLUN_OPENAI_MODEL: 'demo-model'
        })).rejects.toThrow('API root')
    })
})