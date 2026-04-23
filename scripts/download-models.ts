import { mkdir, open, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { basename, join } from 'node:path'
import { buildDownloadSources } from '../src/modeling/downloadSources.js'
import { getAllModelProfiles } from '../src/modeling/modelProfiles.js'
import { resolveModelStoragePaths } from '../src/modeling/modelPaths.js'
import { readModelManifest, writeModelManifest } from '../src/modeling/modelManifest.js'

const DOWNLOAD_LOCK_FILE = '.download.lock'

const runCurl = async (args: string[]): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('curl.exe', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      const errorMessage = stderr.trim() || `curl exited with code ${code ?? 'unknown'}`
      reject(new Error(errorMessage))
    })
  })
}

const downloadFileWithCurl = async (url: string, filePath: string): Promise<void> => {
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
}

const downloadWithFallbacks = async (repository: string, fileName: string, filePath: string): Promise<void> => {
  const sources = buildDownloadSources(repository, fileName)
  let lastError: unknown = null

  for (const source of sources) {
    try {
      await downloadFileWithCurl(source, filePath)
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Curl download failed via ${source}: ${message}`)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to download ${fileName}`)
}

const main = async (): Promise<void> => {
  const projectRoot = process.cwd()
  const appDataDir = process.env['APPDATA'] ? join(process.env['APPDATA'], 'Kunlungame') : join(projectRoot, 'runtime-cache')
  const storage = resolveModelStoragePaths({
    isPackaged: false,
    projectRoot,
    appDataDir
  })

  await mkdir(storage.modelsDir, { recursive: true })
  const lockFile = join(storage.modelsDir, DOWNLOAD_LOCK_FILE)
  const lockHandle = await open(lockFile, 'wx').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') {
      throw new Error(`Another model download is already running. Remove ${lockFile} only if no download process is active.`)
    }

    throw error
  })

  const manifest = await readModelManifest(storage.manifestFile)

  try {
    await lockHandle.writeFile(`${process.pid}\n`)

    for (const profile of getAllModelProfiles()) {
      const targetDir = join(storage.modelsDir, profile.id)
      await mkdir(targetDir, { recursive: true })

      for (const fileName of profile.files) {
        const filePath = join(targetDir, basename(fileName))
        console.log(`Downloading ${profile.id}: ${fileName}`)
        await downloadWithFallbacks(profile.repository, fileName, filePath)
      }

      manifest.records = [
        ...manifest.records.filter((record) => record.profileId !== profile.id),
        {
          profileId: profile.id,
          files: profile.files,
          downloadedAt: new Date().toISOString()
        }
      ]
    }

    await writeModelManifest(storage.manifestFile, manifest)
    console.log(`Model manifest written to ${storage.manifestFile}`)
  } finally {
    await lockHandle.close()
    await rm(lockFile, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
