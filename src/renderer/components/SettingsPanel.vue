<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { BgmControllerState } from "../../presentation/bgmController.js";
import { useFocusTrap } from "../composables/useFocusTrap.js";

interface Props {
  open: boolean;
  bgm: BgmControllerState;
}

interface Emits {
  (event: "close"): void;
  (event: "toggle-bgm"): void;
  (event: "set-volume", value: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const volumePercent = computed(() => Math.round(props.bgm.volume * 100));

const onVolumeInput = (e: Event): void => {
  const target = e.target as HTMLInputElement;
  const next = Number(target.value) / 100;
  emit("set-volume", Number.isFinite(next) ? next : 0);
};

const panelRef = ref<HTMLElement | null>(null);
useFocusTrap(toRef(props, "open"), panelRef);
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
