import { basename, join } from 'node:path'
import { buildDownloadSources } from './downloadSources.js'
import { parseModelArtifactMetadata, verifyModelArtifactFile, type ModelArtifactMetadata } from './modelFileIntegrity.js'
import type { ModelProfile } from './modelProfiles.js'
import { readModelManifest, writeModelManifest, type ModelManifest } from './modelManifest.js'
import type { ModelStoragePaths } from './modelPaths.js'

export type ProfileDownloadPhase =
  | 'starting'
  | 'fetching-metadata'
  | 'downloading'
  | 'verifying'
  | 'file-done'
  | 'manifest-updated'
  | 'completed'
  | 'failed'

export interface ProfileDownloadProgressEvent {
  profileId: string
  fileName: string | null
  phase: ProfileDownloadPhase
  fileIndex: number
  totalFiles: number
  message: string
}

export interface ProfileDownloaderDependencies {
  fetchArtifactMetadata: (url: string) => Promise<ModelArtifactMetadata | null>
  downloadFile: (url: string, filePath: string) => Promise<void>
  verifyFile: (filePath: string, metadata: ModelArtifactMetadata) => Promise<{ ok: boolean; sizeMatches: boolean; hashMatches: boolean | null }>
  removeFile: (filePath: string) => Promise<void>
  ensureDirectory: (dirPath: string) => Promise<void>
  readManifest: (manifestFile: string) => Promise<ModelManifest>
  writeManifest: (manifestFile: string, manifest: ModelManifest) => Promise<void>
  now?: () => Date
}

export interface DownloadProfileInput {
  profile: ModelProfile
  storage: ModelStoragePaths
  deps: ProfileDownloaderDependencies
  onProgress?: (event: ProfileDownloadProgressEvent) => void
}

export interface DownloadProfileResult {
  ok: boolean
  profileId: string
  errorMessage?: string
  lastPhase: ProfileDownloadPhase
}

/**
 * 为单个 profile 做"下载 + 校验 + manifest 记录"，不跑冒烟测试。冒烟测试
 * 在 runtime bootstrap 阶段会自然覆盖，这里保持最小闭环以便从 UI 快速触发。
 *
 * 设计要点：
 * - 所有 I/O（fetch / curl / verify / fs）通过 deps 注入，方便单测。
 * - `onProgress` 报告 phase + 当前文件 + 消息，不包含 byte-level 进度（curl
 *   是黑盒下载），后续可以再挂文件大小轮询扩展。
 */
export const downloadProfileWeights = async (
  input: DownloadProfileInput
): Promise<DownloadProfileResult> => {
  const { profile, storage, deps, onProgress } = input
  const totalFiles = profile.files.length
  const now = deps.now ?? (() => new Date())
  const emit = (event: ProfileDownloadProgressEvent): void => {
    if (onProgress != null) {
      onProgress(event)
    }
  }
  const emitPhase = (phase: ProfileDownloadPhase, fileName: string | null, fileIndex: number, message: string): void => {
    emit({ profileId: profile.id, fileName, phase, fileIndex, totalFiles, message })
  }

  emitPhase('starting', null, 0, `准备下载 ${profile.label} (${totalFiles} 个文件)`)

  const targetDir = join(storage.modelsDir, profile.id)
  try {
    await deps.ensureDirectory(targetDir)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitPhase('failed', null, 0, `无法创建下载目录: ${message}`)
    return { ok: false, profileId: profile.id, errorMessage: message, lastPhase: 'failed' }
  }

  for (let index = 0; index < totalFiles; index += 1) {
    const fileName = profile.files[index]!
    const fileIndex = index + 1
    const filePath = join(targetDir, basename(fileName))
    const sources = buildDownloadSources(profile.repository, fileName)

    let downloaded = false
    let lastError: unknown = null

    for (const source of sources) {
      emitPhase('fetching-metadata', fileName, fileIndex, `读取 ${fileName} 元数据 (${source})`)
      let metadata: ModelArtifactMetadata | null = null
      try {
        metadata = await deps.fetchArtifactMetadata(source)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        emitPhase('fetching-metadata', fileName, fileIndex, `元数据获取失败，将继续尝试下载: ${message}`)
      }

      try {
        emitPhase('downloading', fileName, fileIndex, `下载 ${fileName} 中…`)
        await deps.downloadFile(source, filePath)

        if (metadata != null) {
          emitPhase('verifying', fileName, fileIndex, `校验 ${fileName}`)
          const verification = await deps.verifyFile(filePath, metadata)
          if (!verification.ok) {
            await deps.removeFile(filePath)
            throw new Error(
              `Integrity check failed for ${fileName} (size=${verification.sizeMatches}, hash=${verification.hashMatches ?? 'not-checked'})`
            )
          }
        }

        emitPhase('file-done', fileName, fileIndex, `${fileName} 下载完成`)
        downloaded = true
        break
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : String(error)
        emitPhase('downloading', fileName, fileIndex, `下载失败，尝试下一个镜像: ${message}`)
      }
    }

    if (!downloaded) {
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? `Failed to download ${fileName}`)
      emitPhase('failed', fileName, fileIndex, message)
      return { ok: false, profileId: profile.id, errorMessage: message, lastPhase: 'failed' }
    }
  }

  let manifest: ModelManifest
  try {
    manifest = await deps.readManifest(storage.manifestFile)
  } catch {
    manifest = { records: [] }
  }

  const nowIso = now().toISOString()
  manifest.records = [
    ...manifest.records.filter((record) => record.profileId !== profile.id),
    {
      profileId: profile.id,
      files: [...profile.files],
      downloadedAt: nowIso,
      verifiedAt: nowIso
    }
  ]

  try {
    await deps.writeManifest(storage.manifestFile, manifest)
    emitPhase('manifest-updated', null, totalFiles, 'manifest 已更新')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitPhase('failed', null, totalFiles, `manifest 写入失败: ${message}`)
    return { ok: false, profileId: profile.id, errorMessage: message, lastPhase: 'failed' }
  }

  emitPhase('completed', null, totalFiles, `${profile.label} 全部下载完成`)
  return { ok: true, profileId: profile.id, lastPhase: 'completed' }
}

/**
 * 默认实现，由 Electron main / CLI 脚本包起来注入。
 */
export const buildDefaultProfileDownloaderDependencies = async (): Promise<ProfileDownloaderDependencies> => {
  const { mkdir, rm } = await import('node:fs/promises')
  const { spawn } = await import('node:child_process')

  const runCurl = async (args: string[]): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('curl.exe', args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
      let stderr = ''
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', (error) => reject(error))
      child.on('close', (code) => {
        if (code === 0) {
          resolve()
          return
        }
        reject(new Error(stderr.trim() || `curl exited with code ${code ?? 'unknown'}`))
      })
    })
  }

  return {
    fetchArtifactMetadata: async (url) => {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      if (!response.ok) {
        return null
      }
      const headers: Record<string, string | undefined> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      return parseModelArtifactMetadata(headers)
    },
    downloadFile: async (url, filePath) => {
      await runCurl([
        '--silent',
        '--show-error',
        '--fail',
        '--location',
        '--retry',
        '5',
        '--retry-delay',
        '5',
        '--retry-all-errors',
        '--continue-at',
        '-',
        '--output',
        filePath,
        url
      ])
    },
    verifyFile: verifyModelArtifactFile,
    removeFile: async (filePath) => {
      await rm(filePath, { force: true })
    },
    ensureDirectory: async (dirPath) => {
      await mkdir(dirPath, { recursive: true })
    },
    readManifest: readModelManifest,
    writeManifest: writeModelManifest
  }
}
