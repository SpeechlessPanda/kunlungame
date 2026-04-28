<script setup lang="ts">
import { ref } from "vue";
import {
  CheckCircle2,
  Cloud,
  Cpu,
  Download,
  HardDrive,
  KeyRound,
  PlugZap,
} from "lucide-vue-next";
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
import type {
  DesktopOpenAiCompatibleTestRequest,
  DesktopOpenAiCompatibleTestResult,
} from "../../shared/types/desktop.js";

interface Props {
  modelProvider: ModelProvider;
  openAiCompatible: OpenAiCompatibleSettings;
  preferredModelMode: PreferredModelMode;
  selectedProfileId: string | null;
  profileAvailability?: Record<string, ProfileAvailabilityStatus>;
  downloadStatus?: ProfileDownloadStatus | null;
  /**
   * 由 App.vue 注入的 OpenAI-compatible 连接自检函数。如果未注入（例如 dom 测试中
   * 没接 Electron bridge），按钮会被自动禁用并显示提示，避免误操作。
   */
  runConnectionTest?: (
    request: DesktopOpenAiCompatibleTestRequest,
  ) => Promise<DesktopOpenAiCompatibleTestResult>;
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
    hint: "免费模型波动较大；当前验证以 120B 最稳定。",
    settings: {
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-oss-120b:free",
      fallbackModels: ["meta-llama/llama-3.3-70b-instruct:free"],
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

type ConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; model: string; latencyMs: number }
  | { status: "error"; reason: string; message: string };

const connectionTestState = ref<ConnectionTestState>({ status: "idle" });

const reasonHint = (reason: string): string => {
  switch (reason) {
    case "missing-input":
      return "请先填写 API Key、Base URL 和模型名。";
    case "invalid-base-url":
      return "Base URL 需要以 http:// 或 https:// 开头。";
    case "auth":
      return "鉴权失败：API Key 错误或没有访问该模型的权限。";
    case "model-not-found":
      return "模型名错误：上游不认这个模型，请核对名称是否完全一致（含 :free 后缀等）。";
    case "timeout":
      return "请求超时：检查网络代理或上游是否可达。";
    case "network":
      return "网络异常：请确认能访问 Base URL，所在网络是否需要代理。";
    case "http-error":
      return "上游返回错误状态码，详见下方原始响应。";
    default:
      return "连接失败。";
  }
};

const runConnectionTestClick = async (): Promise<void> => {
  if (props.runConnectionTest == null) {
    connectionTestState.value = {
      status: "error",
      reason: "network",
      message: "桌面端能力不可用：未检测到 Electron bridge，无法发起测试。",
    };
    return;
  }
  connectionTestState.value = { status: "testing" };
  try {
    const result = await props.runConnectionTest({
      apiKey: props.openAiCompatible.apiKey,
      baseUrl: props.openAiCompatible.baseUrl,
      model: props.openAiCompatible.model,
    });
    if (result.ok) {
      connectionTestState.value = {
        status: "ok",
        model: result.model,
        latencyMs: result.latencyMs,
      };
    } else {
      connectionTestState.value = {
        status: "error",
        reason: result.reason,
        message: result.message,
      };
    }
  } catch (error) {
    connectionTestState.value = {
      status: "error",
      reason: "network",
      message: error instanceof Error ? error.message : String(error),
    };
  }
};
</script>

<template>
  <header class="settings-panel__section-header">
    <h3 class="settings-panel__section-title">模型来源</h3>
    <p class="settings-panel__hint">
      推荐接入 OpenAI-compatible API；切换后下一轮对话生效。
    </p>
  </header>
  <div
    class="settings-panel__provider-list"
    role="radiogroup"
    aria-label="模型来源"
  >
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

  <div
    v-if="modelProvider === 'openai-compatible'"
    class="settings-panel__api-form"
    data-testid="settings-openai-form"
  >
    <div
      class="settings-panel__api-warning"
      role="note"
      data-testid="settings-openai-format-warning"
    >
      <strong class="settings-panel__api-warning-title"
        >仅支持 OpenAI 格式 API</strong
      >
      <span class="settings-panel__api-warning-body">
        本应用只走 OpenAI-compatible <code>/chat/completions</code> 流式协议；
        Anthropic 原生（<code>/v1/messages</code>）、Google
        Gemini、百度文心等专属格式无法直接接入， 请使用其官方/网关提供的
        OpenAI-compatible 端点。
      </span>
    </div>
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
          <Cloud
            v-if="preset.id === 'openai'"
            :size="15"
            :stroke-width="1.8"
            aria-hidden="true"
          />
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
        placeholder="meta-llama/llama-3.3-70b-instruct:free"
        :value="openAiCompatible.fallbackModels.join('\n')"
        @input="(event) => updateFallbackModels(textareaValue(event))"
      />
    </label>
    <div
      class="settings-panel__connection-test"
      data-testid="settings-openai-connection-test"
    >
      <button
        type="button"
        class="settings-panel__connection-test-button"
        data-testid="settings-openai-test-connection"
        :disabled="connectionTestState.status === 'testing'"
        @click="runConnectionTestClick"
      >
        <PlugZap :size="14" :stroke-width="1.8" aria-hidden="true" />
        <span v-if="connectionTestState.status === 'testing'"
          >正在测试连接…</span
        >
        <span v-else>测试连接</span>
      </button>
      <p
        v-if="connectionTestState.status === 'idle'"
        class="settings-panel__connection-test-hint"
      >
        点击后会用 max_tokens=1 打一次 /chat/completions，验证 Key、Base URL
        和模型名是否真的能跑通。
      </p>
      <p
        v-else-if="connectionTestState.status === 'ok'"
        class="settings-panel__connection-test-status settings-panel__connection-test-status--ok"
        data-testid="settings-openai-test-result-ok"
        role="status"
      >
        ✅ 连接成功 · 模型 <code>{{ connectionTestState.model }}</code> · 耗时
        {{ connectionTestState.latencyMs }} ms
      </p>
      <div
        v-else-if="connectionTestState.status === 'error'"
        class="settings-panel__connection-test-status settings-panel__connection-test-status--error"
        data-testid="settings-openai-test-result-error"
        role="alert"
      >
        <strong>连接失败：{{ reasonHint(connectionTestState.reason) }}</strong>
        <p
          v-if="connectionTestState.message"
          class="settings-panel__connection-test-detail"
        >
          {{ connectionTestState.message }}
        </p>
      </div>
    </div>
    <p
      class="settings-panel__model-hint settings-panel__api-guidance"
      data-testid="settings-openai-guidance"
    >
      仅支持 OpenAI-compatible 的 /chat/completions 流式格式；Base URL 填 API
      根地址，例如 https://api.openai.com/v1 或
      https://openrouter.ai/api/v1，不要填完整 /chat/completions 路径。推荐
      gpt-4o-mini 获得速度和成本平衡；gpt-4.1-mini 指令遵循更强；gpt-4o
      中文表达更细腻。OpenRouter 免费模型通常以 :free 结尾，当前验证以
      openai/gpt-oss-120b:free 最稳定；Qwen / GLM
      免费档曾出现短答或空流，不作为默认推荐。
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

.settings-panel__api-warning {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(216, 168, 79, 0.48);
  background: rgba(216, 168, 79, 0.12);
  color: #ffe9b8;
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.settings-panel__api-warning code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: rgba(0, 0, 0, 0.32);
  border-radius: 3px;
  padding: 0 4px;
}

.settings-panel__api-warning-title {
  font-weight: 600;
  color: #fff5d8;
}

.settings-panel__api-warning-body {
  color: rgba(255, 246, 232, 0.84);
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

.settings-panel__connection-test {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.settings-panel__connection-test-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(216, 168, 79, 0.55);
  background: rgba(216, 168, 79, 0.18);
  color: #ffe9b8;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition:
    background 120ms ease,
    transform 120ms ease;
}

.settings-panel__connection-test-button:hover:not(:disabled) {
  background: rgba(216, 168, 79, 0.28);
}

.settings-panel__connection-test-button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.settings-panel__connection-test-hint {
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.55);
  line-height: 1.5;
  margin: 0;
}

.settings-panel__connection-test-status {
  font-size: var(--font-size-xs);
  line-height: 1.55;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
}

.settings-panel__connection-test-status code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: rgba(0, 0, 0, 0.32);
  border-radius: 3px;
  padding: 0 4px;
}

.settings-panel__connection-test-status--ok {
  border: 1px solid rgba(120, 196, 144, 0.55);
  background: rgba(120, 196, 144, 0.14);
  color: #c9f3d6;
}

.settings-panel__connection-test-status--error {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(232, 96, 96, 0.6);
  background: rgba(232, 96, 96, 0.12);
  color: #ffd7d7;
}

.settings-panel__connection-test-detail {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  opacity: 0.85;
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
