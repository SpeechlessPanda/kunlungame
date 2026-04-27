<script setup lang="ts">
import { CheckCircle2, Cpu, Download } from "lucide-vue-next";
import {
  getDefaultModelProfile,
  getFallbackModelProfile,
  getProModelProfile,
} from "../../modeling/modelProfiles.js";
import SettingsDownloadProgress from "./SettingsDownloadProgress.vue";
import type {
  PreferredModelMode,
  ProfileAvailabilityStatus,
  ProfileDownloadStatus,
} from "./SettingsPanel.types.js";

interface Props {
  preferredModelMode: PreferredModelMode;
  selectedProfileId: string | null;
  profileAvailability?: Record<string, ProfileAvailabilityStatus>;
  downloadStatus?: ProfileDownloadStatus | null;
}

interface Emits {
  (event: "set-model-mode", mode: PreferredModelMode): void;
  (event: "download-profile", profileId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  profileAvailability: () => ({}),
  downloadStatus: null,
});
const emit = defineEmits<Emits>();

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
    tagline: "Q3_K_M 单文件 ~3.81GB，需手动下载权重",
    hint: "建议 >= 6GB VRAM 独显；相比 Q4_K_M 体积更小、token 生成更快，质量损失 < 3%。",
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

const statusLabel = (profileId: string): string => {
  const status = statusFor(profileId);
  if (status === "missing") return "权重未下载";
  if (status === "partial") return "权重不完整";
  return "权重状态未知";
};

const onDownload = (event: Event, profileId: string): void => {
  event.stopPropagation();
  emit("download-profile", profileId);
};
</script>

<template>
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
      :aria-checked="preferredModelMode === option.mode ? 'true' : 'false'"
      :data-selected="preferredModelMode === option.mode"
      @click="onPickMode(option.mode)"
    >
      <div class="settings-panel__model-row">
        <span class="settings-panel__model-label"
          ><Cpu :size="16" :stroke-width="1.8" aria-hidden="true" />{{
            option.label
          }}</span
        >
        <span
          v-if="selectedProfileId === option.profileId"
          class="settings-panel__model-pill"
          data-testid="settings-model-active-pill"
          ><CheckCircle2
            :size="13"
            :stroke-width="1.8"
            aria-hidden="true"
          />当前加载</span
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
          >{{ statusLabel(option.profileId) }}</span
        >
        <button
          type="button"
          class="settings-panel__model-download"
          :data-testid="`settings-model-download-${option.mode}`"
          @click="(event) => onDownload(event, option.profileId)"
        >
          <Download :size="14" :stroke-width="1.8" aria-hidden="true" />
          下载权重
        </button>
      </div>
      <SettingsDownloadProgress
        v-if="isDownloading(option.profileId) && downloadStatus"
        :mode="option.mode"
        :status="downloadStatus"
      />
    </button>
  </div>
</template>

<style scoped>
.settings-panel__section-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-panel__section-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--font-size-md);
  color: var(--color-foreground-invert);
}

.settings-panel__hint {
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.56);
}

.settings-panel__model-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settings-panel__model-option {
  text-align: left;
  background: rgba(248, 239, 222, 0.08);
  border: 1px solid rgba(216, 168, 79, 0.24);
  border-radius: var(--radius-md);
  padding: 10px var(--space-3);
  color: var(--color-foreground-invert);
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
  background: rgba(248, 239, 222, 0.14);
  border-color: rgba(216, 168, 79, 0.48);
}

.settings-panel__model-option[aria-checked="true"] {
  border-color: rgba(216, 168, 79, 0.72);
  background: rgba(216, 168, 79, 0.14);
}

.settings-panel__model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.settings-panel__model-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-md);
}

.settings-panel__model-pill {
  font-size: var(--font-size-xs);
  color: #ffe4a3;
  border: 1px solid rgba(216, 168, 79, 0.62);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.settings-panel__model-tagline {
  margin: 0;
  font-size: var(--font-size-sm);
  color: rgba(255, 246, 232, 0.72);
}

.settings-panel__model-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.56);
}

.settings-panel__model-cta {
  margin-top: var(--space-1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.settings-panel__model-status {
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.62);
}

.settings-panel__model-download {
  font-size: var(--font-size-xs);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(216, 168, 79, 0.42);
  background: rgba(248, 239, 222, 0.12);
  color: var(--color-foreground-invert);
  cursor: pointer;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.settings-panel__model-download:hover {
  background: rgba(248, 239, 222, 0.2);
}
</style>
