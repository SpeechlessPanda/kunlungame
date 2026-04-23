import { getDefaultModelProfile, getFallbackModelProfile, type ModelProfile } from './modelProfiles.js'
import { resolveModelStoragePaths, type ModelStoragePaths } from './modelPaths.js'

export interface RuntimeBootstrapInput {
  preferredMode: 'default' | 'compatibility'
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

  const selectedProfile =
    input.preferredMode === 'compatibility' ||
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
