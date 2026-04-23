import { join } from 'node:path'

export interface ResolveModelStoragePathsInput {
  isPackaged: boolean
  projectRoot: string
  appDataDir: string
}

export interface ModelStoragePaths {
  modelsDir: string
  manifestFile: string
}

const normalizeWindowsPath = (value: string): string => value.replace(/\\/g, '/')

export const resolveModelStoragePaths = (input: ResolveModelStoragePathsInput): ModelStoragePaths => {
  const baseDir = input.isPackaged
    ? join(input.appDataDir, 'models')
    : join(input.projectRoot, 'runtime-cache', 'models')

  const normalizedBaseDir = normalizeWindowsPath(baseDir)

  return {
    modelsDir: normalizedBaseDir,
    manifestFile: `${normalizedBaseDir}/manifest.json`
  }
}
