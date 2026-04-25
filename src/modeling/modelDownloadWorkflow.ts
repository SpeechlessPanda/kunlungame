import { basename, join } from 'node:path'
import { rm } from 'node:fs/promises'
import { readModelManifest, writeModelManifest, type ModelManifest } from './modelManifest.js'
import type { ModelProfile } from './modelProfiles.js'
import { runModelSmokeTest, type ModelSmokeTestInput } from './modelSmokeTest.js'
import {
  downloadProfileWeights,
  type DownloadProfileInput,
  type ProfileDownloaderDependencies,
  type ProfileDownloadProgressEvent
} from './profileDownloader.js'
import type { ModelStoragePaths } from './modelPaths.js'

export interface ModelDownloadWorkflowDependencies {
  downloadProfileWeights: (input: DownloadProfileInput) => Promise<{ ok: boolean; profileId: string; errorMessage?: string }>
  runSmokeTest: (input: ModelSmokeTestInput) => Promise<void>
  removeDirectory: (directoryPath: string) => Promise<void>
  readManifest: (manifestFile: string) => Promise<ModelManifest>
  writeManifest: (manifestFile: string, manifest: ModelManifest) => Promise<void>
  now?: () => Date
}

export interface DownloadAndSmokeTestProfileInput {
  profile: ModelProfile
  storage: ModelStoragePaths
  downloaderDeps: ProfileDownloaderDependencies
  repairAttempts?: number
  deps?: Partial<ModelDownloadWorkflowDependencies>
  onLog?: (message: string) => void | Promise<void>
  onProgress?: (event: ProfileDownloadProgressEvent) => void
}

const defaultWorkflowDependencies: ModelDownloadWorkflowDependencies = {
  downloadProfileWeights,
  runSmokeTest: async (input) => {
    const result = await runModelSmokeTest(input)
    if (!result.ok) {
      throw new Error(result.errorMessage ?? `Smoke test failed for ${input.profileId}`)
    }
  },
  removeDirectory: async (directoryPath) => {
    await rm(directoryPath, { recursive: true, force: true })
  },
  readManifest: readModelManifest,
  writeManifest: writeModelManifest
}

const updateManifestRecord = async (
  manifestFile: string,
  deps: ModelDownloadWorkflowDependencies,
  updater: (manifest: ModelManifest) => ModelManifest
): Promise<void> => {
  const manifest = await deps.readManifest(manifestFile)
  await deps.writeManifest(manifestFile, updater(manifest))
}

const removeProfileManifestRecord = async (
  manifestFile: string,
  profileId: string,
  deps: ModelDownloadWorkflowDependencies
): Promise<void> => {
  await updateManifestRecord(manifestFile, deps, (manifest) => ({
    records: manifest.records.filter((record) => record.profileId !== profileId)
  }))
}

const markProfileSmokeTested = async (
  manifestFile: string,
  profile: ModelProfile,
  deps: ModelDownloadWorkflowDependencies
): Promise<void> => {
  const smokeTestedAt = (deps.now ?? (() => new Date()))().toISOString()
  await updateManifestRecord(manifestFile, deps, (manifest) => ({
    records: manifest.records.map((record) =>
      record.profileId === profile.id
        ? { ...record, smokeTestedAt }
        : record
    )
  }))
}

const logMessage = async (
  onLog: DownloadAndSmokeTestProfileInput['onLog'],
  message: string
): Promise<void> => {
  if (onLog != null) {
    await onLog(message)
  }
}

export const downloadAndSmokeTestProfile = async (
  input: DownloadAndSmokeTestProfileInput
): Promise<void> => {
  const deps = {
    ...defaultWorkflowDependencies,
    ...input.deps
  }
  const repairAttempts = Math.max(1, input.repairAttempts ?? 2)
  const targetDir = join(input.storage.modelsDir, input.profile.id)
  const modelPath = join(targetDir, basename(input.profile.files[0]!))

  for (let attempt = 1; attempt <= repairAttempts; attempt += 1) {
    await logMessage(input.onLog, `Downloading ${input.profile.id} (attempt ${attempt}/${repairAttempts})`)
    const downloadResult = await deps.downloadProfileWeights({
      profile: input.profile,
      storage: input.storage,
      deps: input.downloaderDeps,
      onProgress: input.onProgress
    })

    if (!downloadResult.ok) {
      throw new Error(downloadResult.errorMessage ?? `Download failed for ${input.profile.id}`)
    }

    try {
      await deps.runSmokeTest({
        profileId: input.profile.id,
        modelPath
      })
      await markProfileSmokeTested(input.storage.manifestFile, input.profile, deps)
      await logMessage(input.onLog, `Smoke test passed for ${input.profile.id}`)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await logMessage(input.onLog, `Smoke test failed for ${input.profile.id} on attempt ${attempt}: ${message}`)
      await deps.removeDirectory(targetDir)
      await removeProfileManifestRecord(input.storage.manifestFile, input.profile.id, deps)

      if (attempt >= repairAttempts) {
        throw new Error(message)
      }
    }
  }
}
