export type PreferredModelMode = 'default' | 'compatibility' | 'pro'

export type ProfileAvailabilityStatus = 'ready' | 'partial' | 'missing' | 'unknown'

export interface ProfileDownloadStatus {
  profileId: string
  phase:
    | 'starting'
    | 'fetching-metadata'
    | 'downloading'
    | 'verifying'
    | 'file-done'
    | 'manifest-updated'
    | 'completed'
    | 'failed'
  fileIndex: number
  totalFiles: number
  message: string
  bytesDownloaded?: number
  totalBytes?: number
}
