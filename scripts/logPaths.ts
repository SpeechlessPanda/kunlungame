import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const LOG_ROOT_DIRNAME = 'logs'

export const buildLogStamp = (): string =>
  new Date().toISOString().replace(/[:.]/g, '-')

export const resolveLogRoot = (projectRoot: string): string =>
  join(projectRoot, LOG_ROOT_DIRNAME)

export const ensureLogDir = async (
  projectRoot: string,
  ...segments: string[]
): Promise<string> => {
  const dir = join(resolveLogRoot(projectRoot), ...segments)
  await mkdir(dir, { recursive: true })
  return dir
}
