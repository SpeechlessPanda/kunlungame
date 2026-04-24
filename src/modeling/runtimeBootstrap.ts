import {
  getDefaultModelProfile,
  getFallbackModelProfile,
  getProModelProfile,
  type ModelProfile
} from './modelProfiles.js'
import { resolveModelStoragePaths, type ModelStoragePaths } from './modelPaths.js'

export type PreferredModelMode = 'default' | 'compatibility' | 'pro'

export interface RuntimeBootstrapInput {
  preferredMode: PreferredModelMode
  availableGpuVramGb: number | null
  isPackaged: boolean
  projectRoot: string
  appDataDir: string
}

export interface RuntimeBootstrapPlan {
  selectedProfile: ModelProfile
  storage: ModelStoragePaths
}

export const buildRuntimeBootstrapPlan = (input: RuntimeBootstrapInput): RuntimeBootstrapPlan => {
  const defaultProfile = getDefaultModelProfile()
  const fallbackProfile = getFallbackModelProfile()
  const proProfile = getProModelProfile()

  // 用户在 Settings 里显式选了 Pro Mode：强制载入 7B 档。若权重缺失，
  // 下游会在 modelPath 校验阶段返回 `model-missing`，UI 据此提示引导下载。
  // 用户选了 Compatibility (1.5B Lite) 也强制走 fallback。
  // 其余情况（默认）按 GPU VRAM 自动判断：VRAM 不足以跑 3B 就自动降到 1.5B。
  const selectedProfile =
    input.preferredMode === 'pro'
      ? proProfile
      : input.preferredMode === 'compatibility' ||
          (input.availableGpuVramGb !== null && input.availableGpuVramGb < defaultProfile.recommendedGpuVramGb)
        ? fallbackProfile
        : defaultProfile

  return {
    selectedProfile,
    storage: resolveModelStoragePaths({
      isPackaged: input.isPackaged,
      projectRoot: input.projectRoot,
      appDataDir: input.appDataDir
    })
  }
}
