import type { DialogueDependencies, DialogueOption } from './dialogueOrchestrator.js'
import type { StoryPrompt } from './storyPromptBuilder.js'

export interface OpenAiCompatibleDialogueDependenciesInput {
  apiKey: string
  baseUrl: string
  model: string
  maxTokens?: number
  temperature?: number
  fetch?: typeof fetch
  generateOptions: DialogueDependencies['generateOptions']
}

interface StreamOpenAiCompatibleTextInput extends Omit<OpenAiCompatibleDialogueDependenciesInput, 'generateOptions'> {
  prompt: StoryPrompt
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/u, '')

const parseSseDataLine = (line: string): string | null => {
  if (!line.startsWith('data:')) return null
  return line.slice('data:'.length).trim()
}

const extractContentDelta = (payload: string): { done: boolean; content: string } => {
  if (payload === '[DONE]') return { done: true, content: '' }
  let parsed: {
    choices?: Array<{ delta?: { content?: unknown } }>
    error?: { message?: unknown; type?: unknown; code?: unknown } | string
  }
  try {
    parsed = JSON.parse(payload) as typeof parsed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Malformed OpenAI-compatible stream payload: ${message}`)
  }

  if (parsed.error != null) {
    const detail = typeof parsed.error === 'string'
      ? parsed.error
      : [parsed.error.message, parsed.error.type, parsed.error.code]
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .join(' ')
    throw new Error(`OpenAI-compatible stream error: ${detail || 'unknown provider error'}`)
  }

  const content = parsed.choices?.[0]?.delta?.content
  return { done: false, content: typeof content === 'string' ? content : '' }
}

async function* readOpenAiCompatibleSse(response: Response): AsyncGenerator<string> {
  if (response.body == null) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let isDone = false

  const drainBlocks = function* (): Generator<string> {
    while (true) {
      const separatorIndex = buffer.indexOf('\n\n')
      if (separatorIndex < 0) return
      const block = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      for (const rawLine of block.split(/\r?\n/u)) {
        const payload = parseSseDataLine(rawLine.trim())
        if (payload == null || payload.length === 0) continue
        const delta = extractContentDelta(payload)
        if (delta.done) {
          isDone = true
          return
        }
        if (delta.content.length > 0) yield delta.content
      }
    }
  }

  while (!isDone) {
    const result = await reader.read()
    if (result.done) break
    buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/gu, '\n')
    for (const content of drainBlocks()) yield content
  }

  buffer += decoder.decode()
  if (!isDone && buffer.trim().length > 0) {
    buffer += '\n\n'
    for (const content of drainBlocks()) yield content
  }
}

export async function* streamOpenAiCompatibleText(input: StreamOpenAiCompatibleTextInput): AsyncGenerator<string> {
  if (input.apiKey.trim().length === 0) {
    throw new Error('OpenAI-compatible API key is required before starting a remote model turn.')
  }

  const fetchImpl = input.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new Error('OpenAI-compatible streaming requires a fetch implementation.')
  }

  const response = await fetchImpl(`${normalizeBaseUrl(input.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      stream: true,
      temperature: input.temperature ?? 0.72,
      max_tokens: input.maxTokens ?? 420,
      messages: [
        { role: 'system', content: input.prompt.system },
        { role: 'user', content: input.prompt.user }
      ]
    })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI-compatible request failed: ${response.status} ${response.statusText}${detail.length > 0 ? ` ${detail}` : ''}`)
  }

  for await (const content of readOpenAiCompatibleSse(response)) {
    yield content
  }
}

export const createOpenAiCompatibleDialogueDependencies = (
  input: OpenAiCompatibleDialogueDependenciesInput
): DialogueDependencies => ({
  streamText: (prompt) => streamOpenAiCompatibleText({ ...input, prompt }),
  generateOptions: async (optionsInput): Promise<DialogueOption[]> => input.generateOptions(optionsInput)
})