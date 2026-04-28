/**
 * 设置面板"测试连接"按钮使用的纯函数：
 * 用最小代价（max_tokens=1，非流式）打一次 /chat/completions，
 * 一次性验证 API Key、Base URL 和模型名是否真的能跑通。
 *
 * 设计取舍：
 *  - 不使用 GET /v1/models 来验证。原因：很多兼容网关的 /models 列表不包含
 *    所有可用模型（OpenRouter 免费模型有时被过滤），列表 200 不代表能调用；
 *    /chat/completions 的最小调用是更可靠的端到端验证。
 *  - max_tokens=1 + stream=false 控制流量到极致。返回正文极短，对账单友好。
 *  - 不重试。如果用户填错，应当让他立刻看到错误并修正，而不是反复消耗 quota。
 *  - 网络/HTTP/鉴权/模型名错误都映射到稳定的 reason 枚举，方便 UI 给中文提示。
 */

export interface OpenAiCompatibleConnectionTestInput {
    apiKey: string
    baseUrl: string
    model: string
    /** 仅在测试场景注入；生产由 IPC 主进程的全局 fetch 提供。 */
    fetch?: typeof fetch
    /** 打到上游的超时时间，默认 15s。 */
    timeoutMs?: number
}

export type OpenAiCompatibleConnectionTestResult =
    | { ok: true; model: string; latencyMs: number }
    | {
        ok: false
        reason: 'missing-input' | 'invalid-base-url' | 'auth' | 'model-not-found' | 'http-error' | 'timeout' | 'network'
        status?: number
        message: string
    }

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/u, '')

const isLikelyHttpUrl = (url: string): boolean => /^https?:\/\//iu.test(url)

const truncate = (text: string, max = 400): string => {
    if (text.length <= max) return text
    return `${text.slice(0, max - 1)}…`
}

export const testOpenAiCompatibleConnection = async (
    input: OpenAiCompatibleConnectionTestInput
): Promise<OpenAiCompatibleConnectionTestResult> => {
    const apiKey = input.apiKey.trim()
    const baseUrl = normalizeBaseUrl(input.baseUrl)
    const model = input.model.trim()

    if (apiKey.length === 0 || baseUrl.length === 0 || model.length === 0) {
        return {
            ok: false,
            reason: 'missing-input',
            message: '请先填写 API Key、Base URL 和模型名后再测试连接。'
        }
    }

    if (!isLikelyHttpUrl(baseUrl)) {
        return {
            ok: false,
            reason: 'invalid-base-url',
            message: 'Base URL 需要以 http:// 或 https:// 开头，例如 https://api.openai.com/v1'
        }
    }

    const fetchImpl = input.fetch ?? globalThis.fetch
    if (typeof fetchImpl !== 'function') {
        return {
            ok: false,
            reason: 'network',
            message: '当前环境不支持 fetch，无法测试连接。'
        }
    }

    const timeoutMs = input.timeoutMs ?? 15_000
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = Date.now()

    try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                max_tokens: 1,
                stream: false,
                messages: [{ role: 'user', content: 'ping' }]
            }),
            signal: controller.signal
        })

        const latencyMs = Date.now() - startedAt

        if (response.ok) {
            return { ok: true, model, latencyMs }
        }

        let bodyText = ''
        try {
            bodyText = await response.text()
        } catch {
            bodyText = ''
        }

        const lowerBody = bodyText.toLowerCase()
        let reason: 'auth' | 'model-not-found' | 'http-error' = 'http-error'
        if (response.status === 401 || response.status === 403) {
            reason = 'auth'
        } else if (
            response.status === 404 ||
            lowerBody.includes('model_not_found') ||
            lowerBody.includes('model not found') ||
            lowerBody.includes('no such model') ||
            lowerBody.includes('not a valid model')
        ) {
            reason = 'model-not-found'
        }

        return {
            ok: false,
            reason,
            status: response.status,
            message: truncate(bodyText.trim().length > 0 ? bodyText.trim() : `HTTP ${response.status} ${response.statusText}`)
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                ok: false,
                reason: 'timeout',
                message: `连接超过 ${Math.round(timeoutMs / 1000)} 秒未返回，请检查网络或 Base URL 是否可达。`
            }
        }
        return {
            ok: false,
            reason: 'network',
            message: error instanceof Error ? error.message : String(error)
        }
    } finally {
        clearTimeout(timeoutHandle)
    }
}
