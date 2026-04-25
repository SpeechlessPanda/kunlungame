<script setup lang="ts">
import { computed } from 'vue'
import type { PreferredModelMode, ProfileDownloadStatus } from './SettingsPanel.types.js'

interface Props {
  mode: PreferredModelMode
  status: ProfileDownloadStatus
}

const props = defineProps<Props>()

const formatMegabytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`
}

const downloadByteSummary = computed<string | null>(() => {
  if (props.status.phase !== 'downloading') return null
  const bytes = props.status.bytesDownloaded ?? 0
  const total = props.status.totalBytes ?? 0
  if (total > 0) {
    const percent = Math.min(100, Math.max(0, Math.round((bytes / total) * 100)))
    return `${formatMegabytes(bytes)} / ${formatMegabytes(total)} · ${percent}%`
  }
  if (bytes > 0) {
    return `${formatMegabytes(bytes)} 已下载`
  }
  return null
})

const phaseLabelMap: Record<ProfileDownloadStatus['phase'], string> = {
  starting: '准备中',
  'fetching-metadata': '读取元信息',
  downloading: '下载中',
  verifying: '校验中',
  'file-done': '分片完成',
  'manifest-updated': '更新清单',
  completed: '已完成',
  failed: '失败'
}

const downloadPhaseLabel = computed<string>(() => phaseLabelMap[props.status.phase])
</script>

<template>
  <div
    class="settings-panel__model-progress"
    :data-testid="`settings-model-progress-${mode}`"
  >
    <span class="settings-panel__model-progress-phase">
      {{ status.totalFiles ? `(${status.fileIndex}/${status.totalFiles})` : "" }}
      {{ downloadPhaseLabel }} {{ status.message || "正在下载…" }}
    </span>
    <span
      v-if="downloadByteSummary"
      class="settings-panel__model-progress-bytes"
      :data-testid="`settings-model-progress-bytes-${mode}`"
    >
      {{ downloadByteSummary }}
    </span>
  </div>
</template>

<style scoped>
.settings-panel__model-progress {
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-foreground-muted);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.settings-panel__model-progress-phase {
  display: inline-block;
}

.settings-panel__model-progress-bytes {
  display: inline-block;
  font-family: var(--font-sans);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
}
</style>
