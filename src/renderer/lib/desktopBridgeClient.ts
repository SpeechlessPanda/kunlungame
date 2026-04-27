/**
 * 渲染层用的 IPC 边界守门：在调用 `window.kunlunDesktop` 的每个返回点上做 Zod 运行时校验。
 *
 * 为什么放在渲染层而不是 preload：
 *  - preload 在 `sandbox: true` 下不能 `require('zod')`（dep 被 externalizeDepsPlugin 标记为外部）。
 *  - 校验作用是"防御主进程实现漂移"，在消费方做最稳妥；
 *  - 渲染层已经依赖 zod（`runtimeStateSchema`），不引入新依赖。
 *
 * 校验失败 → 抛出 IpcContractError，调用方按既有 catch 处理（log + UI 失败态）。
 */
import type {
  DesktopBridge,
  DesktopMainlineTurnRequest,
  DesktopMainlineTurnStreamEvent,
  DesktopProfileDownloadProgressEvent
} from '../../shared/types/desktop.js'
import {
  desktopDialogueSmokeResultSchema,
  desktopDownloadProfileResultSchema,
  desktopMainlineTurnStreamEventSchema,
  desktopMainlineTurnResultSchema,
  desktopProfileAvailabilitySchema,
  desktopProfileDownloadProgressEventSchema,
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
  async runDialogueSmoke() {
    const result = await raw.runDialogueSmoke()
    return parseOrThrow('desktop:run-dialogue-smoke', desktopDialogueSmokeResultSchema, result)
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
  async getProfileAvailability(profileId: string) {
    const result = await raw.getProfileAvailability(profileId)
    return parseOrThrow('desktop:get-profile-availability', desktopProfileAvailabilitySchema, result)
  },
  async downloadProfile(profileId: string) {
    const result = await raw.downloadProfile(profileId)
    return parseOrThrow('desktop:download-profile', desktopDownloadProfileResultSchema, result)
  },
  onProfileDownloadProgress(handler: (event: DesktopProfileDownloadProgressEvent) => void) {
    return raw.onProfileDownloadProgress((event) => {
      // 进度事件失败不应影响整体下载链路；记录并丢弃畸形事件。
      try {
        const parsed = desktopProfileDownloadProgressEventSchema.parse(event)
        handler(parsed)
      } catch (error) {
        console.warn('[ipc:desktop:profile-download-progress] 畸形事件已丢弃', error, event)
      }
    })
  }
})
