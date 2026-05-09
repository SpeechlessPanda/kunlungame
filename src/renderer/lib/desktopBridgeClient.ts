import type {
  DesktopBridge,
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnStreamEvent
} from '../../shared/types/desktop.js'
import {
  desktopMainlineTurnStreamEventSchema,
  desktopMainlineTurnResultSchema,
  desktopOpenAiCompatibleTestResultSchema,
  desktopRuntimeStateSnapshotSchema,
  desktopStartupSnapshotSchema
} from '../../shared/types/desktop.schemas.js'

export class IpcContractError extends Error {
  readonly channel: string
  readonly cause: unknown

  constructor(channel: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`[ipc:${channel}] 主进程返回的数据未通过结构校验：${detail}`)
    this.name = 'IpcContractError'
    this.channel = channel
    this.cause = cause
  }
}

const parseOrThrow = <T>(
  channel: string,
  schema: { parse: (value: unknown) => T },
  value: unknown
): T => {
  try {
    return schema.parse(value)
  } catch (error) {
    throw new IpcContractError(channel, error)
  }
}

export const wrapDesktopBridgeWithValidation = (raw: DesktopBridge): DesktopBridge => ({
  async ping() {
    const result = await raw.ping()
    if (typeof result !== 'string') {
      throw new IpcContractError('desktop:ping', new TypeError(`expected string, got ${typeof result}`))
    }
    return result
  },
  async quitApp() {
    await raw.quitApp()
  },
  async getStartupSnapshot() {
    const result = await raw.getStartupSnapshot()
    return parseOrThrow('desktop:get-startup-snapshot', desktopStartupSnapshotSchema, result)
  },
  async runMainlineTurn(request: DesktopMainlineTurnRequest) {
    const result = await raw.runMainlineTurn(request)
    return parseOrThrow('desktop:run-mainline-turn', desktopMainlineTurnResultSchema, result)
  },
  async streamMainlineTurn(
    request: DesktopMainlineTurnRequest,
    onEvent: (event: DesktopMainlineTurnStreamEvent) => void
  ): Promise<void> {
    if (raw.streamMainlineTurn == null) {
      throw new IpcContractError('desktop:stream-mainline-turn', new TypeError('streamMainlineTurn is not available'))
    }
    await raw.streamMainlineTurn(request, (event) => {
      onEvent(parseOrThrow('desktop:stream-mainline-turn', desktopMainlineTurnStreamEventSchema, event))
    })
  },
  async loadRuntimeState() {
    const result = await raw.loadRuntimeState()
    return parseOrThrow('desktop:load-runtime-state', desktopRuntimeStateSnapshotSchema, result)
  },
  async saveRuntimeState(state) {
    await raw.saveRuntimeState(state)
  },
  async testOpenAiCompatibleConnection(request) {
    const result = await raw.testOpenAiCompatibleConnection(request)
    return parseOrThrow('desktop:test-openai-compatible', desktopOpenAiCompatibleTestResultSchema, result)
  }
})
