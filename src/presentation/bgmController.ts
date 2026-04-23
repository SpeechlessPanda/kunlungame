/**
 * BGM 控制器 (Part 07)。
 *
 * 视觉层的 BGM 播放是一个可选、非阻塞的表现能力：
 *   - 如果音频文件不存在，必须降级为静音而不是阻塞主界面。
 *   - 玩家开关设置必须即时生效。
 *   - 控制器只负责状态，实际播放由渲染层的 HTMLAudioElement 承担。
 */
export interface BgmControllerState {
  enabled: boolean
  volume: number
  sourceAvailable: boolean
}

export interface BgmControllerActions {
  enable(): BgmControllerState
  disable(): BgmControllerState
  toggle(): BgmControllerState
  setVolume(value: number): BgmControllerState
  markSourceAvailable(available: boolean): BgmControllerState
}

export interface BgmController extends BgmControllerActions {
  snapshot(): BgmControllerState
}

export const DEFAULT_BGM_VOLUME = 0.6

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

export const createBgmController = (
  initial?: Partial<BgmControllerState>
): BgmController => {
  let state: BgmControllerState = {
    enabled: initial?.enabled ?? true,
    volume: clamp01(initial?.volume ?? DEFAULT_BGM_VOLUME),
    sourceAvailable: initial?.sourceAvailable ?? false
  }

  const snapshot = (): BgmControllerState => ({ ...state })

  return {
    snapshot,
    enable() {
      state = { ...state, enabled: true }
      return snapshot()
    },
    disable() {
      state = { ...state, enabled: false }
      return snapshot()
    },
    toggle() {
      state = { ...state, enabled: !state.enabled }
      return snapshot()
    },
    setVolume(value: number) {
      state = { ...state, volume: clamp01(value) }
      return snapshot()
    },
    markSourceAvailable(available: boolean) {
      state = { ...state, sourceAvailable: available }
      if (!available) {
        state = { ...state, enabled: false }
      }
      return snapshot()
    }
  }
}

/**
 * 根据控制器状态决定实际是否需要 HTMLAudioElement 产生声音。
 * 规则：必须启用 + 必须有可用源 + 音量 > 0。
 */
export const isAudible = (state: BgmControllerState): boolean => {
  return state.enabled && state.sourceAvailable && state.volume > 0
}
