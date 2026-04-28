import { describe, expect, it, vi } from 'vitest'
import { testOpenAiCompatibleConnection } from '../src/modeling/openAiCompatibleConnectionTest.js'

const buildResponse = (status: number, body = ''): Response => {
    return new Response(body, { status, headers: { 'content-type': 'text/plain' } })
}

describe('testOpenAiCompatibleConnection', () => {
    it('在缺少 API Key、Base URL 或模型名时直接返回 missing-input', async () => {
        const fetchSpy = vi.fn()
        const result = await testOpenAiCompatibleConnection({
            apiKey: '   ',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('missing-input')
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('在 Base URL 不是 http(s) 协议时直接返回 invalid-base-url', async () => {
        const fetchSpy = vi.fn()
        const result = await testOpenAiCompatibleConnection({
            apiKey: 'sk-x',
            baseUrl: 'wss://example.com',
            model: 'gpt-4o-mini',
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('invalid-base-url')
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('用最小请求体 max_tokens=1 stream=false 命中 /chat/completions', async () => {
        const fetchSpy = vi.fn(async () => buildResponse(200, '{}'))
        const result = await testOpenAiCompatibleConnection({
            apiKey: 'sk-x',
            baseUrl: 'https://api.openai.com/v1/',
            model: 'gpt-4o-mini',
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(true)
        const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('https://api.openai.com/v1/chat/completions')
        const body = JSON.parse(init.body as string)
        expect(body).toMatchObject({ model: 'gpt-4o-mini', max_tokens: 1, stream: false })
        expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-x')
    })

    it('401/403 响应映射为 auth 失败原因', async () => {
        const fetchSpy = vi.fn(async () => buildResponse(401, '{"error":"unauthorized"}'))
        const result = await testOpenAiCompatibleConnection({
            apiKey: 'sk-x',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('auth')
            expect(result.status).toBe(401)
        }
    })

    it('404 或包含 model_not_found 的 4xx 响应映射为 model-not-found', async () => {
        const fetchSpy = vi.fn(async () => buildResponse(400, '{"error":{"message":"The model `gpt-9` does not exist","code":"model_not_found"}}'))
        const result = await testOpenAiCompatibleConnection({
            apiKey: 'sk-x',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-9',
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('model-not-found')
    })

    it('网络异常被映射为 network 失败原因并保留原始消息', async () => {
        const fetchSpy = vi.fn(async () => {
            throw new Error('ENOTFOUND api.example.com')
        })
        const result = await testOpenAiCompatibleConnection({
            apiKey: 'sk-x',
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o-mini',
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe('network')
            expect(result.message).toContain('ENOTFOUND')
        }
    })

    it('AbortError 被映射为 timeout 失败原因', async () => {
        const fetchSpy = vi.fn(async () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            throw err
        })
        const result = await testOpenAiCompatibleConnection({
            apiKey: 'sk-x',
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-4o-mini',
            timeoutMs: 50,
            fetch: fetchSpy as unknown as typeof fetch
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('timeout')
    })
})
