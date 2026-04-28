<script setup lang="ts">
import { CheckCircle2, Cloud, Cpu, Download, HardDrive, KeyRound } from "lucide-vue-next";
import {
  getDefaultModelProfile,
  getFallbackModelProfile,
  getProModelProfile,
} from "../../modeling/modelProfiles.js";
import SettingsDownloadProgress from "./SettingsDownloadProgress.vue";
import type {
  ModelProvider,
  OpenAiCompatibleSettings,
  PreferredModelMode,
  ProfileAvailabilityStatus,
  ProfileDownloadStatus,
} from "./SettingsPanel.types.js";

interface Props {
  modelProvider: ModelProvider;
  openAiCompatible: OpenAiCompatibleSettings;
  preferredModelMode: PreferredModelMode;
  selectedProfileId: string | null;
  profileAvailability?: Record<string, ProfileAvailabilityStatus>;
  downloadStatus?: ProfileDownloadStatus | null;
}

interface Emits {
  (event: "set-model-provider", provider: ModelProvider): void;
  (event: "update-openai-compatible", settings: OpenAiCompatibleSettings): void;
  (event: "set-model-mode", mode: PreferredModelMode): void;
  (event: "download-profile", profileId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  profileAvailability: () => ({}),
  downloadStatus: null,
});
const emit = defineEmits<Emits>();

const providerOptions: Array<{
  provider: ModelProvider;
  label: string;
  hint: string;
}> = [
  {
    provider: "openai-compatible",
    label: "API 模型（推荐）",
    hint: "中文更稳、输出更快，适合正式游玩。",
  },
  {
    provider: "local",
    label: "本地模型",
    hint: "离线兜底，需要先下载 GGUF 权重。",
  },
];

interface ModelModeOption {
  mode: PreferredModelMode;
  profileId: string;
  label: string;
  tagline: string;
  hint: string;
}

interface ApiProviderPreset {
  id: "openai" | "openrouter-free";
  label: string;
  hint: string;
  settings: Omit<OpenAiCompatibleSettings, "apiKey">;
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

const apiProviderPresets: ApiProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI 官方",
    hint: "速度、中文质量和稳定性最均衡。",
    settings: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      fallbackModels: [],
    },
  },
  {
    id: "openrouter-free",
    label: "OpenRouter 免费",
    hint: "免费模型波动较大，已预填备用池。",
    settings: {
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-chat-v3-0324:free",
      fallbackModels: [
        "qwen/qwen3-235b-a22b:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
      ],
    },
  },
];

const onPickMode = (mode: PreferredModelMode): void => {
  if (props.preferredModelMode === mode) return;
  emit("set-model-mode", mode);
};

const onPickProvider = (provider: ModelProvider): void => {
  if (props.modelProvider === provider) return;
  emit("set-model-provider", provider);
};

const updateOpenAiCompatible = <Key extends keyof OpenAiCompatibleSettings>(
  key: Key,
  value: OpenAiCompatibleSettings[Key],
): void => {
  emit("update-openai-compatible", {
    ...props.openAiCompatible,
    [key]: value,
  });
};

const eventValue = (event: Event): string => {
  return event.target instanceof HTMLInputElement ? event.target.value : "";
};

const textareaValue = (event: Event): string => {
  return event.target instanceof HTMLTextAreaElement ? event.target.value : "";
};

const updateFallbackModels = (value: string): void => {
  updateOpenAiCompatible(
    "fallbackModels",
    value
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
};

const applyApiProviderPreset = (preset: ApiProviderPreset): void => {
  emit("update-openai-compatible", {
    apiKey: props.openAiCompatible.apiKey,
    ...preset.settings,
  });
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
    <h3 class="settings-panel__section-title">模型来源</h3>
    <p class="settings-panel__hint">
      推荐接入 OpenAI-compatible API；切换后下一轮对话生效。
    </p>
  </header>
  <div class="settings-panel__provider-list" role="radiogroup" aria-label="模型来源">
    <button
      v-for="option in providerOptions"
      :key="option.provider"
      type="button"
      role="radio"
      class="settings-panel__provider-option"
      :data-testid="`settings-provider-${option.provider}`"
      :aria-checked="modelProvider === option.provider ? 'true' : 'false'"
      @click="onPickProvider(option.provider)"
    >
      <span class="settings-panel__provider-label">
        <Cloud
          v-if="option.provider === 'openai-compatible'"
          :size="16"
          :stroke-width="1.8"
          aria-hidden="true"
        />
        <HardDrive v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
        {{ option.label }}
      </span>
      <span class="settings-panel__provider-hint">{{ option.hint }}</span>
    </button>
  </div>

  <div v-if="modelProvider === 'openai-compatible'" class="settings-panel__api-form" data-testid="settings-openai-form">
    <div class="settings-panel__preset-list" aria-label="API 接入预设">
      <button
        v-for="preset in apiProviderPresets"
        :key="preset.id"
        type="button"
        class="settings-panel__preset-button"
        :data-testid="`settings-openai-preset-${preset.id}`"
        @click="applyApiProviderPreset(preset)"
      >
        <span class="settings-panel__preset-label">
          <Cloud v-if="preset.id === 'openai'" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <KeyRound v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          {{ preset.label }}
        </span>
        <span class="settings-panel__preset-hint">{{ preset.hint }}</span>
      </button>
    </div>
    <label class="settings-panel__field">
      <span class="settings-panel__field-label">
        <KeyRound :size="14" :stroke-width="1.8" aria-hidden="true" />API Key
      </span>
      <input
        class="settings-panel__input"
        data-testid="settings-openai-api-key"
        type="password"
        autocomplete="off"
        placeholder="sk-..."
        :value="openAiCompatible.apiKey"
        @input="(event) => updateOpenAiCompatible('apiKey', eventValue(event))"
      />
    </label>
    <label class="settings-panel__field">
      <span class="settings-panel__field-label">Base URL</span>
      <input
        class="settings-panel__input"
        data-testid="settings-openai-base-url"
        type="url"
        autocomplete="off"
        :value="openAiCompatible.baseUrl"
        @input="(event) => updateOpenAiCompatible('baseUrl', eventValue(event))"
      />
    </label>
    <label class="settings-panel__field">
      <span class="settings-panel__field-label">模型名</span>
      <input
        class="settings-panel__input"
        data-testid="settings-openai-model"
        type="text"
        autocomplete="off"
        :value="openAiCompatible.model"
        @input="(event) => updateOpenAiCompatible('model', eventValue(event))"
      />
    </label>
    <label class="settings-panel__field">
      <span class="settings-panel__field-label">备用模型</span>
      <textarea
        class="settings-panel__input settings-panel__textarea"
        data-testid="settings-openai-fallback-models"
        autocomplete="off"
        rows="3"
        placeholder="deepseek/deepseek-chat-v3-0324:free"
        :value="openAiCompatible.fallbackModels.join('\n')"
        @input="(event) => updateFallbackModels(textareaValue(event))"
      />
    </label>
    <p class="settings-panel__model-hint settings-panel__api-guidance" data-testid="settings-openai-guidance">
      推荐 gpt-4o-mini 获得速度和成本平衡；gpt-4.1-mini 指令遵循更强；gpt-4o 中文表达更细腻。OpenRouter 免费模型通常以 :free 结尾，例如 deepseek/deepseek-chat-v3-0324:free，可一行一个作为备用。
    </p>
  </div>

  <template v-if="modelProvider === 'local'">
    <header class="settings-panel__section-header settings-panel__local-header">
      <h3 class="settings-panel__section-title">本地模型档位</h3>
      <p class="settings-panel__hint">
        本地离线可用，但生成速度取决于 GPU/CPU 和权重大小。
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

.settings-panel__provider-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.settings-panel__provider-option {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 76px;
  padding: 10px var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid rgba(216, 168, 79, 0.24);
  background: rgba(248, 239, 222, 0.08);
  color: var(--color-foreground-invert);
  cursor: pointer;
}

.settings-panel__provider-option:hover,
.settings-panel__provider-option:focus-visible {
  background: rgba(248, 239, 222, 0.14);
  border-color: rgba(216, 168, 79, 0.48);
}

.settings-panel__provider-option[aria-checked="true"] {
  border-color: rgba(216, 168, 79, 0.72);
  background: rgba(216, 168, 79, 0.14);
}

.settings-panel__provider-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-foreground-invert);
}

.settings-panel__provider-hint {
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.6);
  line-height: 1.45;
}

.settings-panel__api-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 10px var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid rgba(216, 168, 79, 0.2);
  background: rgba(5, 11, 13, 0.16);
}

.settings-panel__preset-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.settings-panel__preset-button {
  min-height: 68px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(216, 168, 79, 0.24);
  background: rgba(248, 239, 222, 0.08);
  color: var(--color-foreground-invert);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-panel__preset-button:hover,
.settings-panel__preset-button:focus-visible {
  background: rgba(248, 239, 222, 0.14);
  border-color: rgba(216, 168, 79, 0.48);
}

.settings-panel__preset-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-foreground-invert);
}

.settings-panel__preset-hint {
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: rgba(255, 246, 232, 0.6);
}

.settings-panel__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-panel__field-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.72);
}

.settings-panel__input {
  width: 100%;
  min-height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(216, 168, 79, 0.28);
  background: rgba(248, 239, 222, 0.1);
  color: var(--color-foreground-invert);
  padding: 8px 10px;
  font: inherit;
  outline: none;
}

.settings-panel__input:focus-visible {
  border-color: rgba(216, 168, 79, 0.72);
  box-shadow: 0 0 0 2px rgba(216, 168, 79, 0.18);
}

.settings-panel__textarea {
  resize: vertical;
  min-height: 84px;
  line-height: 1.45;
}

.settings-panel__api-guidance {
  line-height: 1.55;
}

.settings-panel__local-header {
  margin-top: var(--space-2);
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

@media (max-width: 520px) {
  .settings-panel__provider-list {
    grid-template-columns: 1fr;
  }
}
</style>
