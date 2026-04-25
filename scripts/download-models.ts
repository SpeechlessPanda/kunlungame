import { appendFile, mkdir, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { getAllModelProfiles, getOptionalModelProfiles, type ModelProfile } from '../src/modeling/modelProfiles.js'
import { resolveModelStoragePaths } from '../src/modeling/modelPaths.js'
import { downloadAndSmokeTestProfile } from '../src/modeling/modelDownloadWorkflow.js'
import { buildDefaultProfileDownloaderDependencies } from '../src/modeling/profileDownloader.js'
import { buildLogStamp, ensureLogDir } from './logPaths.js'

const DOWNLOAD_LOCK_FILE = '.download.lock'
const PROFILE_SMOKE_TEST_REPAIR_ATTEMPTS = 2

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

  const downloaderDeps = await buildDefaultProfileDownloaderDependencies()

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
      const progressLogWrites: Array<Promise<void>> = []
      await downloadAndSmokeTestProfile({
        profile,
        storage,
        downloaderDeps,
        repairAttempts: PROFILE_SMOKE_TEST_REPAIR_ATTEMPTS,
        onLog: log,
        onProgress: (event) => {
          if (event.bytesDownloaded == null) {
            progressLogWrites.push(log(`[${event.profileId}] ${event.message}`))
          }
        }
      })
      await Promise.all(progressLogWrites)
    }

    await log('[download] run completed successfully')
  } finally {
    // 清理锁文件失败不应掩盖上面的下载错误：如果 try 块招了下载错，
    // close()/rm() 再招错会覆盖原始错误堆栈，让“为什么下载失败”变不可诊。
    try {
      await lockHandle.close()
    } catch (closeError) {
      console.error('[download] lock file handle close failed (suppressed):', closeError)
    }
    try {
      await rm(lockFile, { force: true })
    } catch (rmError) {
      console.error('[download] lock file remove failed (suppressed):', rmError)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
