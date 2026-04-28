import { describe, expect, it, vi } from 'vitest'
import { createOpenAiCompatibleDialogueDependencies } from '../src/modeling/openAiCompatibleDialogueDependencies.js'

const streamFromText = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    }
  })
}

const okStreamResponse = (text: string): Response => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  body: streamFromText(text),
  text: async () => text
} as Response)

describe('createOpenAiCompatibleDialogueDependencies', () => {
  it('streams OpenAI chat-completions SSE chunks and preserves system/user roles', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okStreamResponse([
      'data: {"choices":[{"delta":{"content":"昆仑子说"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"，这条线很长。"}}]}',
      '',
      'data: [DONE]',
      ''
    ].join('\n')))

    const deps = createOpenAiCompatibleDialogueDependencies({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.test/v1/',
      model: 'gpt-4.1-mini',
      fetch: fetchMock,
      generateOptions: async () => [
        { semantic: 'align', label: '原来如此。' },
        { semantic: 'challenge', label: '证据呢？' }
      ]
    })

    const chunks: string[] = []
    for await (const chunk of deps.streamText({ system: '系统规则', user: '用户上下文' })) {
      if (typeof chunk === 'string') chunks.push(chunk)
    }

    expect(chunks).toEqual(['昆仑子说', '，这条线很长。'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.example.test/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      model: 'gpt-4.1-mini',
      stream: true,
      messages: [
        { role: 'system', content: '系统规则' },
        { role: 'user', content: '用户上下文' }
      ]
    })
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('delegates option generation to the injected option builder', async () => {
    const deps = createOpenAiCompatibleDialogueDependencies({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      fetch: vi.fn(),
      generateOptions: async ({ semantics }) => semantics.map((semantic) => ({ semantic, label: `${semantic}-label` }))
    })

    await expect(deps.generateOptions({ semantics: ['align', 'challenge'] } as never)).resolves.toEqual([
      { semantic: 'align', label: 'align-label' },
      { semantic: 'challenge', label: 'challenge-label' }
    ])
  })

  it('throws a clear error when apiKey is missing', async () => {
    const fetchMock = vi.fn()
    const deps = createOpenAiCompatibleDialogueDependencies({
      apiKey: '   ',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      fetch: fetchMock,
      generateOptions: async () => []
    })

    await expect(async () => {
      for await (const _chunk of deps.streamText({ system: 's', user: 'u' })) {
        void _chunk
      }
    }).rejects.toThrow('API key')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('includes response body text in HTTP failure errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      body: null,
      text: async () => '{"error":"bad key"}'
    } as Response)
    const deps = createOpenAiCompatibleDialogueDependencies({
      apiKey: 'sk-bad',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      fetch: fetchMock,
      generateOptions: async () => []
    })

    await expect(async () => {
      for await (const _chunk of deps.streamText({ system: 's', user: 'u' })) {
        void _chunk
      }
    }).rejects.toThrow(/401.*bad key/)
  })

  it('throws a clear error for malformed SSE payloads', async () => {
    const deps = createOpenAiCompatibleDialogueDependencies({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      fetch: vi.fn().mockResolvedValue(okStreamResponse('data: {not-json}\n\n')),
      generateOptions: async () => []
    })

    await expect(async () => {
      for await (const _chunk of deps.streamText({ system: 's', user: 'u' })) {
        void _chunk
      }
    }).rejects.toThrow(/Malformed OpenAI-compatible stream payload/)
  })

  it('surfaces OpenAI-compatible stream error payloads', async () => {
    const deps = createOpenAiCompatibleDialogueDependencies({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      fetch: vi.fn().mockResolvedValue(okStreamResponse('data: {"error":{"message":"quota exceeded"}}\n\n')),
      generateOptions: async () => []
    })

    await expect(async () => {
      for await (const _chunk of deps.streamText({ system: 's', user: 'u' })) {
        void _chunk
      }
    }).rejects.toThrow(/quota exceeded/)
  })
})