import { appendFile, mkdir, open, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { basename, join } from 'node:path'
import { buildDownloadSources } from '../src/modeling/downloadSources.js'
import { parseModelArtifactMetadata, verifyModelArtifactFile } from '../src/modeling/modelFileIntegrity.js'
import { getAllModelProfiles, getOptionalModelProfiles, type ModelProfile } from '../src/modeling/modelProfiles.js'
import { resolveModelStoragePaths } from '../src/modeling/modelPaths.js'
import { readModelManifest, writeModelManifest } from '../src/modeling/modelManifest.js'
import { runModelSmokeTest } from '../src/modeling/modelSmokeTest.js'
import { buildLogStamp, ensureLogDir } from './logPaths.js'

const DOWNLOAD_LOCK_FILE = '.download.lock'
const PROFILE_SMOKE_TEST_REPAIR_ATTEMPTS = 2

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

const fetchRemoteArtifactMetadata = async (url: string) => {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow'
  })

  if (!response.ok) {
    throw new Error(`Metadata request failed with status ${response.status}`)
  }

  const headers: Record<string, string | undefined> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  return parseModelArtifactMetadata(headers)
}

const downloadWithFallbacks = async (repository: string, fileName: string, filePath: string): Promise<void> => {
  const sources = buildDownloadSources(repository, fileName)
  let lastError: unknown = null

  for (const source of sources) {
    let metadata = null

    try {
      metadata = await fetchRemoteArtifactMetadata(source)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Metadata fetch failed via ${source}: ${message}`)
    }

    try {
      await downloadFileWithCurl(source, filePath)

      if (metadata != null) {
        const verification = await verifyModelArtifactFile(filePath, metadata)
        if (!verification.ok) {
          await rm(filePath, { force: true })
          throw new Error(
            [
              `Integrity check failed for ${fileName}`,
              `sizeMatches=${verification.sizeMatches}`,
              `hashMatches=${verification.hashMatches ?? 'not-checked'}`
            ].join(' ')
          )
        }
      }

      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Curl download failed via ${source}: ${message}`)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to download ${fileName}`)
}

const smokeTestProfile = async (profileId: string, modelPath: string) => {
  const result = await runModelSmokeTest({
    profileId,
    modelPath
  })

  if (!result.ok) {
    throw new Error(result.errorMessage ?? `Smoke test failed for ${profileId}`)
  }

  return result
}

const main = async (): Promise<void> => {
  const projectRoot = process.cwd()
  const includePro = process.argv.slice(2).some((arg) => arg === '--include-pro' || arg === '--pro')
  const logDir = await ensureLogDir(projectRoot, 'model-downloads')
  const runStamp = buildLogStamp()
  const logFile = join(logDir, `model-download-${runStamp}.log`)
  const log = async (message: string): Promise<void> => {
    const line = `[${new Date().toISOString()}] ${message}\n`
    await appendFile(logFile, line, 'utf8')
    console.log(message)
  }

  await log(`[download] run started; log file: ${logFile}`)

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

    const targetProfiles: ModelProfile[] = [
      ...getAllModelProfiles(),
      ...(includePro ? getOptionalModelProfiles() : [])
    ]
    if (includePro) {
      await log('[download] --include-pro flag set: Pro 7B Q3_K_M will be fetched after default+lite.')
    }

    for (const profile of targetProfiles) {
      const targetDir = join(storage.modelsDir, profile.id)
      await mkdir(targetDir, { recursive: true })

      let smokeTestedAt: string | null = null
      let verifiedAt: string | null = null

      for (let attempt = 1; attempt <= PROFILE_SMOKE_TEST_REPAIR_ATTEMPTS; attempt += 1) {
        for (const fileName of profile.files) {
          const filePath = join(targetDir, basename(fileName))
          await log(`Downloading ${profile.id}: ${fileName}`)
          await downloadWithFallbacks(profile.repository, fileName, filePath)
        }

        verifiedAt = new Date().toISOString()

        try {
          await smokeTestProfile(profile.id, join(targetDir, basename(profile.files[0])))
          smokeTestedAt = new Date().toISOString()
          break
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await log(`Smoke test failed for ${profile.id} on attempt ${attempt}: ${message}`)

          if (attempt >= PROFILE_SMOKE_TEST_REPAIR_ATTEMPTS) {
            throw new Error(`Model smoke test failed for ${profile.id}: ${message}`)
          }

          await rm(targetDir, { recursive: true, force: true })
          await mkdir(targetDir, { recursive: true })
        }
      }

      manifest.records = [
        ...manifest.records.filter((record) => record.profileId !== profile.id),
        {
          profileId: profile.id,
          files: profile.files,
          downloadedAt: new Date().toISOString(),
          verifiedAt: verifiedAt ?? undefined,
          smokeTestedAt: smokeTestedAt ?? undefined
        }
      ]
    }

    await writeModelManifest(storage.manifestFile, manifest)
    await log(`Model manifest written to ${storage.manifestFile}`)
    await log('[download] run completed successfully')
  } finally {
    await lockHandle.close()
    await rm(lockFile, { force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
