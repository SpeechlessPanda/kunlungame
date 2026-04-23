import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DownloadedModelRecord {
  profileId: string
  files: string[]
  downloadedAt: string
}

export interface ModelManifest {
  records: DownloadedModelRecord[]
}

export const readModelManifest = async (manifestFile: string): Promise<ModelManifest> => {
  try {
    const raw = await readFile(manifestFile, 'utf8')
    return JSON.parse(raw) as ModelManifest
  } catch {
    return { records: [] }
  }
}

export const writeModelManifest = async (manifestFile: string, manifest: ModelManifest): Promise<void> => {
  await mkdir(dirname(manifestFile), { recursive: true })
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8')
}
