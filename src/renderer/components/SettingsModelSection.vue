<script setup lang="ts">
import { ref } from "vue";
import {
  Cloud,
  KeyRound,
  PlugZap,
} from "lucide-vue-next";
import type { OpenAiCompatibleSettings } from "./SettingsPanel.types.js";
import type {
  DesktopOpenAiCompatibleTestRequest,
  DesktopOpenAiCompatibleTestResult,
} from "../../shared/types/desktop.js";

interface Props {
  openAiCompatible: OpenAiCompatibleSettings;
  runConnectionTest?: (
    request: DesktopOpenAiCompatibleTestRequest,
  ) => Promise<DesktopOpenAiCompatibleTestResult>;
}

interface Emits {
  (event: "update-openai-compatible", settings: OpenAiCompatibleSettings): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

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
      return "模型名错误：上游不认这个模型，请核对名称是否完全一致。";
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
    <h3 class="settings-panel__section-title">模型设置</h3>
    <p class="settings-panel__hint">
      配置 OpenAI-compatible API 接入；修改后下一轮对话生效。
    </p>
  </header>

  <div class="settings-panel__api-form">
    <div
      class="settings-panel__api-warning"
      role="note"
    >
      <strong class="settings-panel__api-warning-title"
        >仅支持 OpenAI 格式 API</strong
      >
      <span class="settings-panel__api-warning-body">
        本应用使用 OpenAI-compatible <code>/chat/completions</code> 流式协议。
        请确认您的 API 服务支持此格式。
      </span>
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
        placeholder="每行一个备用模型名"
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
</style>
