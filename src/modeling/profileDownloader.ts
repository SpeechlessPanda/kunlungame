import { basename, join } from 'node:path'
import { buildDownloadSources } from './downloadSources.js'
import { parseModelArtifactMetadata, verifyModelArtifactFile, type ModelArtifactMetadata } from './modelFileIntegrity.js'
import type { ModelProfile } from './modelProfiles.js'
import { readModelManifest, writeModelManifest, type ModelManifest } from './modelManifest.js'
import type { ModelStoragePaths } from './modelPaths.js'

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const fixed = value >= 100 ? value.toFixed(0) : value.toFixed(1)
  return `${fixed} ${units[unitIndex]}`
}

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
  /** 当 phase === 'downloading' 时由 downloadFile 反馈的已下载字节数；其他阶段通常缺省。 */
  bytesDownloaded?: number
  /** Content-Length + 已存在的断点长度。0 表示服务器未返回大小，UI 应回退到"下载中…"。 */
  totalBytes?: number
}

export type DownloadFileByteProgress = (bytesDownloaded: number, totalBytes: number) => void

export interface ProfileDownloaderDependencies {
  fetchArtifactMetadata: (url: string) => Promise<ModelArtifactMetadata | null>
  downloadFile: (url: string, filePath: string, onByteProgress?: DownloadFileByteProgress) => Promise<void>
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
  const emitBytes = (fileName: string, fileIndex: number, bytesDownloaded: number, totalBytes: number): void => {
    emit({
      profileId: profile.id,
      fileName,
      phase: 'downloading',
      fileIndex,
      totalFiles,
      message: totalBytes > 0
        ? `${formatBytes(bytesDownloaded)} / ${formatBytes(totalBytes)}`
        : `${formatBytes(bytesDownloaded)} …`,
      bytesDownloaded,
      totalBytes
    })
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
        await deps.downloadFile(source, filePath, (bytes, total) => {
          emitBytes(fileName, fileIndex, bytes, total)
        })

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
 *
 * 下载采用 `fetch + ReadableStream` 方案，天然拿到 Content-Length 与逐 chunk 字节计数，
 * 方便上层计算百分比；断点续传通过 `Range` 头 + 文件 append flag 处理。重试最多 3 次，
 * 每次失败后根据本地已落盘字节数重算 Range。
 */
export const buildDefaultProfileDownloaderDependencies = async (): Promise<ProfileDownloaderDependencies> => {
  const { mkdir, rm, stat } = await import('node:fs/promises')
  const { createWriteStream } = await import('node:fs')

  const streamDownload = async (
    url: string,
    filePath: string,
    onByteProgress?: DownloadFileByteProgress
  ): Promise<void> => {
    const maxAttempts = 3
    let lastError: unknown = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let existingBytes = 0
      try {
        const stats = await stat(filePath)
        existingBytes = stats.size
      } catch {
        existingBytes = 0
      }

      const headers: Record<string, string> = {}
      if (existingBytes > 0) {
        headers.Range = `bytes=${existingBytes}-`
      }

      let response: Response
      try {
        response = await fetch(url, { redirect: 'follow', headers })
      } catch (error) {
        lastError = error
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
        throw error instanceof Error ? error : new Error(String(error))
      }

      // 416 = Range Not Satisfiable —— 本地文件已经等于或超过服务器长度，视作完成。
      if (response.status === 416) {
        if (onByteProgress != null) {
          onByteProgress(existingBytes, existingBytes)
        }
        return
      }
      if (!response.ok && response.status !== 206) {
        lastError = new Error(`HTTP ${response.status} for ${url}`)
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }

      const contentLengthHeader = Number(response.headers.get('content-length') ?? '0')
      const append = response.status === 206
      const total = contentLengthHeader > 0 ? contentLengthHeader + (append ? existingBytes : 0) : 0
      let received = append ? existingBytes : 0

      const writer = createWriteStream(filePath, { flags: append ? 'a' : 'w' })
      const body = response.body
      if (body == null) {
        writer.destroy()
        throw new Error(`fetch response body was empty for ${url}`)
      }

      const reader = body.getReader()
      let lastEmitAt = 0
      try {
        if (onByteProgress != null) {
          onByteProgress(received, total)
        }
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (value != null) {
            const chunk = Buffer.from(value)
            if (!writer.write(chunk)) {
              await new Promise<void>((resolve) => writer.once('drain', () => resolve()))
            }
            received += chunk.byteLength
            const nowMs = Date.now()
            if (onByteProgress != null && nowMs - lastEmitAt >= 250) {
              lastEmitAt = nowMs
              onByteProgress(received, total)
            }
          }
        }
        await new Promise<void>((resolve, reject) => {
          writer.end(() => resolve())
          writer.once('error', (err) => reject(err))
        })
        if (onByteProgress != null) {
          onByteProgress(received, total)
        }
        return
      } catch (error) {
        writer.destroy()
        lastError = error
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
        throw error instanceof Error ? error : new Error(String(error))
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'download failed'))
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
    downloadFile: async (url, filePath, onByteProgress) => {
      await streamDownload(url, filePath, onByteProgress)
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
