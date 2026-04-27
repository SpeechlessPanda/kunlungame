<script setup lang="ts">
import { ref, toRef } from "vue";
import { SlidersHorizontal, X } from "lucide-vue-next";
import type { BgmControllerState } from "../../presentation/bgmController.js";
import { useFocusTrap } from "../composables/useFocusTrap.js";
import SettingsAudioSection from "./SettingsAudioSection.vue";
import SettingsModelSection from "./SettingsModelSection.vue";
import type {
  PreferredModelMode,
  ProfileAvailabilityStatus,
  ProfileDownloadStatus,
} from "./SettingsPanel.types.js";

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
        <h2 id="settings-title" class="settings-panel__title">
          <SlidersHorizontal
            :size="20"
            :stroke-width="1.8"
            aria-hidden="true"
          />
          设置
        </h2>
        <button
          type="button"
          class="settings-panel__close"
          data-testid="settings-close"
          aria-label="关闭设置"
          @click="emit('close')"
        >
          <X :size="20" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </header>

      <section class="settings-panel__section">
        <SettingsAudioSection
          :bgm="bgm"
          @toggle-bgm="emit('toggle-bgm')"
          @set-volume="(value) => emit('set-volume', value)"
        />
      </section>

      <section
        class="settings-panel__section"
        data-testid="settings-model-section"
      >
        <SettingsModelSection
          :preferred-model-mode="preferredModelMode"
          :selected-profile-id="selectedProfileId"
          :profile-availability="profileAvailability"
          :download-status="downloadStatus"
          @set-model-mode="(mode) => emit('set-model-mode', mode)"
          @download-profile="(profileId) => emit('download-profile', profileId)"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(5, 11, 13, 0.62);
  backdrop-filter: blur(8px);
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  padding: var(--space-4);
}

.settings-panel {
  width: min(440px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: linear-gradient(
    180deg,
    rgba(33, 48, 48, 0.96),
    rgba(17, 28, 30, 0.96)
  );
  border: 1px solid rgba(216, 168, 79, 0.36);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-surface);
  padding: var(--space-4);
  color: var(--color-foreground-invert);
}

.settings-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.settings-panel__title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
  letter-spacing: 0;
}

.settings-panel__close {
  background: transparent;
  border: none;
  color: rgba(255, 246, 232, 0.72);
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-grid;
  place-items: center;
}

.settings-panel__close:hover,
.settings-panel__close:focus-visible {
  background: rgba(248, 239, 222, 0.12);
  color: var(--color-foreground-invert);
}

.settings-panel__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.settings-panel__section + .settings-panel__section {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid rgba(216, 168, 79, 0.24);
}
</style>
