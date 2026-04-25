<script setup lang="ts">
import { ref, toRef } from "vue";
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
  background: rgba(71, 31, 49, 0.42);
  backdrop-filter: blur(8px);
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  padding: var(--space-6);
}

.settings-panel {
  width: min(420px, 100%);
  background:
    linear-gradient(
      180deg,
      rgba(255, 251, 247, 0.96) 0%,
      rgba(255, 247, 241, 0.94) 100%
    );
  border: 1px solid var(--color-border-strong);
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
  letter-spacing: 0.08em;
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
</style>
