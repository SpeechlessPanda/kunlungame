import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDownloadSources } from './downloadSources.js'
import { readModelManifest, type ModelManifest } from './modelManifest.js'
import { getDefaultModelProfile, getFallbackModelProfile, type ModelProfile } from './modelProfiles.js'
import { buildRuntimeBootstrapPlan, type RuntimeBootstrapInput } from './runtimeBootstrap.js'

export type ModelSetupEntryPoint = 'startup' | 'settings'
export type ModelAvailabilityStatus = 'ready' | 'partial' | 'missing'
export type ModelShellAction = 'launch-ready' | 'auto-download-required' | 'settings-download-required'
export type ModelRecoveryAction = 'retry-download' | 'switch-to-mirror' | 'open-network-help' | 'switch-to-compatibility'
export type ModelDownloadIssueStage = 'failed'
export type ModelDownloadStage = 'checking' | 'queued' | 'downloading' | 'switching-to-mirror' | 'completed' | 'failed'

export interface ModelDownloadProgressEvent {
  profileId: string
  fileName: string
  downloadedBytes: number
  totalBytes: number | null
  percent: number | null
  sourceLabel: 'primary' | 'mirror'
}

export interface ModelDownloadStatusEvent {
  stage: ModelDownloadStage
  profileId: string
  message: string
}

export interface ModelProfileAvailability {
  profileId: string
  status: ModelAvailabilityStatus
  expectedFiles: string[]
  presentFiles: string[]
  missingFiles: string[]
  completionRatio: number
  manifestDownloadedAt: string | null
}

export interface ModelDownloadUiContract {
  channels: {
    startDownload: 'model-download:start'
    progress: 'model-download:progress'
    status: 'model-download:status'
    issue: 'model-download:issue'
    cancelDownload: 'model-download:cancel'
  }
  stages: ModelDownloadStage[]
  recoveryActions: ModelRecoveryAction[]
  downloadSources: Array<{
    label: 'primary' | 'mirror'
    url: string
  }>
}

export interface ModelSetupPlan {
  shellAction: ModelShellAction
  autoDownload: boolean
  selectedProfile: ModelProfile
  selectedProfileAvailability: ModelProfileAvailability
  fallbackProfileAvailability: ModelProfileAvailability
  uiContract: ModelDownloadUiContract
  settingsEntryPoint: {
    defaultTab: 'models'
    highlightProfileId: string
  }
}

export interface ModelDownloadIssueView {
  stage: ModelDownloadIssueStage
  headline: string
  detail: string
  recoveryActions: ModelRecoveryAction[]
  suggestedFixes: string[]
}

export interface BuildModelSetupPlanInput extends RuntimeBootstrapInput {
  entryPoint: ModelSetupEntryPoint
}

export interface ModelSetupPlannerDependencies {
  readManifest: (manifestFile: string) => Promise<ModelManifest>
  fileExists: (filePath: string) => Promise<boolean>
}

const defaultDependencies: ModelSetupPlannerDependencies = {
  readManifest: readModelManifest,
  fileExists: async (filePath) => {
    try {
      await access(filePath, constants.F_OK)
      return true
    } catch {
      return false
    }
  }
}

const evaluateProfileAvailability = async (
  profile: ModelProfile,
  modelsDir: string,
  manifest: ModelManifest,
  fileExists: ModelSetupPlannerDependencies['fileExists']
): Promise<ModelProfileAvailability> => {
  const presentFiles: string[] = []
  const missingFiles: string[] = []

  for (const fileName of profile.files) {
    const exists = await fileExists(join(modelsDir, profile.id, fileName))
    if (exists) {
      presentFiles.push(fileName)
    } else {
      missingFiles.push(fileName)
    }
  }

  const record = manifest.records.find((item) => item.profileId === profile.id) ?? null
  const status: ModelAvailabilityStatus = presentFiles.length === profile.files.length
    ? 'ready'
    : presentFiles.length > 0
      ? 'partial'
      : 'missing'

  return {
    profileId: profile.id,
    status,
    expectedFiles: [...profile.files],
    presentFiles,
    missingFiles,
    completionRatio: profile.files.length === 0 ? 0 : presentFiles.length / profile.files.length,
    manifestDownloadedAt: record?.downloadedAt ?? null
  }
}

const buildUiContract = (profile: ModelProfile, preferredMode: RuntimeBootstrapInput['preferredMode']): ModelDownloadUiContract => {
  const downloadSources = buildDownloadSources(profile.repository, profile.files[0]).map((url, index) => ({
    label: (index === 0 ? 'primary' : 'mirror') as 'primary' | 'mirror',
    url
  }))

  const recoveryActions: ModelRecoveryAction[] = ['retry-download', 'open-network-help']
  if (downloadSources.some((source) => source.label === 'mirror')) {
    recoveryActions.push('switch-to-mirror')
  }
  if (preferredMode !== 'compatibility') {
    // default 或 pro 模式下，若下载/加载失败，可以建议降级到更轻的档位。
    recoveryActions.push('switch-to-compatibility')
  }

  return {
    channels: {
      startDownload: 'model-download:start',
      progress: 'model-download:progress',
      status: 'model-download:status',
      issue: 'model-download:issue',
      cancelDownload: 'model-download:cancel'
    },
    stages: ['checking', 'queued', 'downloading', 'switching-to-mirror', 'completed', 'failed'],
    recoveryActions,
    downloadSources
  }
}

export const buildModelSetupPlan = async (
  input: BuildModelSetupPlanInput,
  dependencies: Partial<ModelSetupPlannerDependencies> = {}
): Promise<ModelSetupPlan> => {
  const resolvedDependencies = {
    ...defaultDependencies,
    ...dependencies
  }
  const bootstrap = buildRuntimeBootstrapPlan(input)
  const manifest = await resolvedDependencies.readManifest(bootstrap.storage.manifestFile)
  const selectedProfileAvailability = await evaluateProfileAvailability(
    bootstrap.selectedProfile,
    bootstrap.storage.modelsDir,
    manifest,
    resolvedDependencies.fileExists
  )
  const fallbackProfile = getFallbackModelProfile()
  const fallbackProfileAvailability = await evaluateProfileAvailability(
    fallbackProfile,
    bootstrap.storage.modelsDir,
    manifest,
    resolvedDependencies.fileExists
  )

  const shellAction: ModelShellAction = selectedProfileAvailability.status === 'ready'
    ? 'launch-ready'
    : input.entryPoint === 'startup'
      ? 'auto-download-required'
      : 'settings-download-required'

  return {
    shellAction,
    autoDownload: shellAction === 'auto-download-required',
    selectedProfile: bootstrap.selectedProfile,
    selectedProfileAvailability,
    fallbackProfileAvailability,
    uiContract: buildUiContract(bootstrap.selectedProfile, input.preferredMode),
    settingsEntryPoint: {
      defaultTab: 'models',
      highlightProfileId: bootstrap.selectedProfile.id
    }
  }
}

export const buildModelDownloadIssueView = (input: {
  failedSourceLabel: 'primary' | 'mirror'
  hasMirrorSource: boolean
  errorMessage: string
  preferredMode: RuntimeBootstrapInput['preferredMode']
}): ModelDownloadIssueView => {
  const recoveryActions: ModelRecoveryAction[] = ['retry-download', 'open-network-help']
  const suggestedFixes = ['检查网络连接或稍后重试。']

  if (input.failedSourceLabel === 'primary' && input.hasMirrorSource) {
    recoveryActions.push('switch-to-mirror')
    suggestedFixes.push('主下载源失败后，允许切换到镜像继续下载。')
  }

  if (input.preferredMode !== 'compatibility') {
    recoveryActions.push('switch-to-compatibility')
    suggestedFixes.push('如果当前模式下载持续失败，可切换到兼容模式继续完成首次启动。')
  }

  return {
    stage: 'failed',
    headline: '模型下载失败',
    detail: `当前源 ${input.failedSourceLabel} 返回错误：${input.errorMessage}`,
    recoveryActions,
    suggestedFixes
  }
}

export const getSupportedModelProfiles = (): ModelProfile[] => [getDefaultModelProfile(), getFallbackModelProfile()]