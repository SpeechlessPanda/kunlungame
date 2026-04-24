<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { BgmControllerState } from "../../presentation/bgmController.js";
import { useFocusTrap } from "../composables/useFocusTrap.js";
import {
  getDefaultModelProfile,
  getFallbackModelProfile,
  getProModelProfile,
} from "../../modeling/modelProfiles.js";

type PreferredModelMode = "default" | "compatibility" | "pro";

export type ProfileAvailabilityStatus =
  | "ready"
  | "partial"
  | "missing"
  | "unknown";

export interface ProfileDownloadStatus {
  profileId: string;
  phase:
    | "starting"
    | "fetching-metadata"
    | "downloading"
    | "verifying"
    | "file-done"
    | "manifest-updated"
    | "completed"
    | "failed";
  fileIndex: number;
  totalFiles: number;
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
}

interface Props {
  open: boolean;
  bgm: BgmControllerState;
  preferredModelMode: PreferredModelMode;
  selectedProfileId: string | null;
  profileAvailability?: Record<string, ProfileAvailabilityStatus>;
  downloadStatus?: ProfileDownloadStatus | null;
}

interface Emits {
  (event: "close"): void;
  (event: "toggle-bgm"): void;
  (event: "set-volume", value: number): void;
  (event: "set-model-mode", mode: PreferredModelMode): void;
  (event: "download-profile", profileId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  profileAvailability: () => ({}),
  downloadStatus: null,
});
const emit = defineEmits<Emits>();

const volumePercent = computed(() => Math.round(props.bgm.volume * 100));

const onVolumeInput = (e: Event): void => {
  const target = e.target as HTMLInputElement;
  const next = Number(target.value) / 100;
  emit("set-volume", Number.isFinite(next) ? next : 0);
};

const panelRef = ref<HTMLElement | null>(null);
useFocusTrap(toRef(props, "open"), panelRef);

// 三档模型档位：UI 展示用的元数据。profileId 与 modelProfiles 保持一致，
// 便于 Settings 里高亮"当前实际加载的档位"（和用户选择可能不同——例如
// Pro 权重缺失时会自动降到 default）。
interface ModelModeOption {
  mode: PreferredModelMode;
  profileId: string;
  label: string;
  tagline: string;
  hint: string;
}

const defaultProfile = getDefaultModelProfile();
const fallbackProfile = getFallbackModelProfile();
const proProfile = getProModelProfile();

const modelModeOptions: ModelModeOption[] = [
  {
    mode: "default",
    profileId: defaultProfile.id,
    label: "Quality Mode · 3B（默认）",
    tagline: "质量稳定，GPU 约 6-15 秒/轮",
    hint: "适合 4GB+ VRAM 独显或较新 CPU；指令遵循稳定，典故覆盖最密。",
  },
  {
    mode: "compatibility",
    profileId: fallbackProfile.id,
    label: "Lite Mode · 1.5B",
    tagline: "纯 CPU 兜底，约 3-5 秒/轮",
    hint: "无独显或旧机器用这一档。轻量但偶尔会复述禁用开场、密度较低。",
  },
  {
    mode: "pro",
    profileId: proProfile.id,
    label: "Pro Mode · 7B（可选）",
    tagline: "体积较大，需手动下载权重",
    hint: "约 4.5GB 权重 + 需要 >= 6GB VRAM；切换后若未下载将提示模型缺失。",
  },
];

const onPickMode = (mode: PreferredModelMode): void => {
  if (props.preferredModelMode === mode) return;
  emit("set-model-mode", mode);
};

const statusFor = (profileId: string): ProfileAvailabilityStatus => {
  return props.profileAvailability?.[profileId] ?? "unknown";
};

const isDownloading = (profileId: string): boolean => {
  return (
    props.downloadStatus != null &&
    props.downloadStatus.profileId === profileId &&
    props.downloadStatus.phase !== "completed" &&
    props.downloadStatus.phase !== "failed"
  );
};

const showDownloadButton = (profileId: string): boolean => {
  const status = statusFor(profileId);
  return status !== "ready" && !isDownloading(profileId);
};

const onDownload = (event: Event, profileId: string): void => {
  event.stopPropagation();
  emit("download-profile", profileId);
};

const formatMegabytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
};

const downloadByteSummary = computed<string | null>(() => {
  const status = props.downloadStatus;
  if (status == null || status.phase !== "downloading") return null;
  const bytes = status.bytesDownloaded ?? 0;
  const total = status.totalBytes ?? 0;
  if (total > 0) {
    const percent = Math.min(100, Math.max(0, Math.round((bytes / total) * 100)));
    return `${formatMegabytes(bytes)} / ${formatMegabytes(total)} · ${percent}%`;
  }
  if (bytes > 0) {
    return `${formatMegabytes(bytes)} 已下载`;
  }
  return null;
});
</script>

<template>
  <div
    v-if="open"
    class="settings-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    data-testid="settings-overlay"
    @click.self="emit('close')"
  >
    <div class="settings-panel" ref="panelRef" data-testid="settings-panel">
      <header class="settings-panel__header">
        <h2 id="settings-title" class="settings-panel__title">设置</h2>
        <button
          type="button"
          class="settings-panel__close"
          data-testid="settings-close"
          aria-label="关闭设置"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <section class="settings-panel__section">
        <div class="settings-panel__row">
          <div>
            <p class="settings-panel__label">BGM 开关</p>
            <p class="settings-panel__hint">
              {{ bgm.sourceAvailable ? "可用" : "音频资源缺失，已自动静音" }}
            </p>
          </div>
          <button
            type="button"
            class="settings-panel__switch"
            role="switch"
            data-testid="settings-bgm-toggle"
            :aria-checked="bgm.enabled ? 'true' : 'false'"
            :disabled="!bgm.sourceAvailable"
            @click="emit('toggle-bgm')"
          >
            <span class="settings-panel__switch-thumb" :data-on="bgm.enabled" />
          </button>
        </div>

        <div class="settings-panel__row">
          <div>
            <p class="settings-panel__label">音量</p>
            <p class="settings-panel__hint" data-testid="settings-volume-value">
              {{ volumePercent }}%
            </p>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            :value="volumePercent"
            class="settings-panel__range"
            data-testid="settings-volume"
            :disabled="!bgm.enabled"
            @input="onVolumeInput"
          />
        </div>
      </section>

      <section
        class="settings-panel__section"
        data-testid="settings-model-section"
      >
        <header class="settings-panel__section-header">
          <h3 class="settings-panel__section-title">模型档位</h3>
          <p class="settings-panel__hint">
            切换后下一轮对话生效；不会中断当前正在进行的一轮。
          </p>
        </header>
        <div
          class="settings-panel__model-list"
          role="radiogroup"
          aria-label="模型档位"
        >
          <button
            v-for="option in modelModeOptions"
            :key="option.mode"
            type="button"
            role="radio"
            class="settings-panel__model-option"
            :data-testid="`settings-model-${option.mode}`"
            :aria-checked="
              preferredModelMode === option.mode ? 'true' : 'false'
            "
            :data-selected="preferredModelMode === option.mode"
            @click="onPickMode(option.mode)"
          >
            <div class="settings-panel__model-row">
              <span class="settings-panel__model-label">{{
                option.label
              }}</span>
              <span
                v-if="selectedProfileId === option.profileId"
                class="settings-panel__model-pill"
                data-testid="settings-model-active-pill"
                >当前加载</span
              >
            </div>
            <p class="settings-panel__model-tagline">{{ option.tagline }}</p>
            <p class="settings-panel__model-hint">{{ option.hint }}</p>
            <div
              v-if="showDownloadButton(option.profileId)"
              class="settings-panel__model-cta"
            >
              <span
                class="settings-panel__model-status"
                :data-testid="`settings-model-status-${option.mode}`"
                >{{
                  statusFor(option.profileId) === "missing"
                    ? "权重未下载"
                    : statusFor(option.profileId) === "partial"
                      ? "权重不完整"
                      : "权重状态未知"
                }}</span
              >
              <button
                type="button"
                class="settings-panel__model-download"
                :data-testid="`settings-model-download-${option.mode}`"
                @click="(event) => onDownload(event, option.profileId)"
              >
                下载权重
              </button>
            </div>
            <div
              v-if="isDownloading(option.profileId)"
              class="settings-panel__model-progress"
              :data-testid="`settings-model-progress-${option.mode}`"
            >
              <span class="settings-panel__model-progress-phase">
                {{
                  downloadStatus?.totalFiles
                    ? `(${downloadStatus.fileIndex}/${downloadStatus.totalFiles})`
                    : ""
                }}
                {{ downloadStatus?.message ?? "正在下载…" }}
              </span>
              <span
                v-if="downloadByteSummary"
                class="settings-panel__model-progress-bytes"
                :data-testid="`settings-model-progress-bytes-${option.mode}`"
              >
                {{ downloadByteSummary }}
              </span>
            </div>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 16, 0.6);
  backdrop-filter: blur(4px);
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  padding: var(--space-6);
}

.settings-panel {
  width: min(420px, 100%);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-surface);
  padding: var(--space-5);
  color: var(--color-foreground);
}

.settings-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.settings-panel__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
}

.settings-panel__close {
  background: transparent;
  border: none;
  color: var(--color-foreground-muted);
  font-size: var(--font-size-xl);
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.settings-panel__close:hover,
.settings-panel__close:focus-visible {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-foreground);
}

.settings-panel__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settings-panel__section + .settings-panel__section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.settings-panel__section-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-panel__section-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--font-size-md);
}

.settings-panel__model-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settings-panel__model-option {
  text-align: left;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-foreground);
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-panel__model-option:hover,
.settings-panel__model-option:focus-visible {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border-strong);
}

.settings-panel__model-option[aria-checked="true"] {
  border-color: var(--color-accent);
  background: rgba(217, 119, 6, 0.08);
}

.settings-panel__model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.settings-panel__model-label {
  font-size: var(--font-size-md);
}

.settings-panel__model-pill {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  padding: 2px 8px;
}

.settings-panel__model-tagline {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-foreground-muted);
}

.settings-panel__model-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-foreground-dim);
}

.settings-panel__model-cta {
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.settings-panel__model-status {
  font-size: var(--font-size-xs);
  color: var(--color-foreground-muted);
}

.settings-panel__model-download {
  font-size: var(--font-size-xs);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-foreground);
  cursor: pointer;
}

.settings-panel__model-download:hover {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.05));
}

.settings-panel__model-progress {
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-foreground-muted);
}

.settings-panel__model-progress-phase {
  display: inline-block;
}

.settings-panel__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.settings-panel__label {
  margin: 0;
  font-size: var(--font-size-md);
}

.settings-panel__hint {
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-foreground-dim);
}

.settings-panel__switch {
  width: 52px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--color-border-strong);
  background: rgba(255, 255, 255, 0.06);
  position: relative;
  padding: 0;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-standard);
}

.settings-panel__switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.settings-panel__switch[aria-checked="true"] {
  background: rgba(63, 154, 106, 0.45);
}

.settings-panel__switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-foreground);
  transition: transform var(--motion-fast) var(--ease-standard);
}

.settings-panel__switch-thumb[data-on="true"] {
  transform: translateX(22px);
}

.settings-panel__range {
  width: 160px;
}
</style>
