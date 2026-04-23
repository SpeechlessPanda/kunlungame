import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export interface ModelArtifactMetadata {
  contentLength: number | null
  sha256: string | null
}

export interface ModelArtifactVerificationResult {
  ok: boolean
  sizeMatches: boolean
  hashMatches: boolean | null
  actualSize: number
  actualSha256: string | null
}

export const parseModelArtifactMetadata = (headers: Record<string, string | undefined>): ModelArtifactMetadata => {
  const rawContentLength = headers['content-length']
  const parsedContentLength = rawContentLength == null ? Number.NaN : Number.parseInt(rawContentLength, 10)
  const rawSha256 = headers['x-linked-etag']?.replaceAll('"', '').trim().toLowerCase() ?? null

  return {
    contentLength: Number.isFinite(parsedContentLength) ? parsedContentLength : null,
    sha256: rawSha256 && rawSha256.length > 0 ? rawSha256 : null
  }
}

const calculateSha256 = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256')

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve())
    stream.on('error', (error) => reject(error))
  })

  return hash.digest('hex')
}

export const verifyModelArtifactFile = async (
  filePath: string,
  metadata: ModelArtifactMetadata
): Promise<ModelArtifactVerificationResult> => {
  const fileStat = await stat(filePath)
  const actualSize = fileStat.size
  const sizeMatches = metadata.contentLength == null ? true : actualSize === metadata.contentLength
  const actualSha256 = metadata.sha256 == null ? null : await calculateSha256(filePath)
  const hashMatches = metadata.sha256 == null ? null : actualSha256 === metadata.sha256

  return {
    ok: sizeMatches && hashMatches !== false,
    sizeMatches,
    hashMatches,
    actualSize,
    actualSha256
  }
}