<script setup lang="ts">
import { computed } from "vue";
import type { StoryNode } from "../../shared/contracts/contentContracts.js";
import type { BgmControllerState } from "../../presentation/bgmController.js";
import {
  resolveBackgroundPresentation,
  resolveCharacterPresentation,
  type CharacterPresentation,
} from "../../presentation/assetSlotResolver.js";
import type {
  ChoiceModel,
  TurnViewModel,
} from "../composables/useTurnController.js";
import { useKeyboardControls } from "../composables/useKeyboardControls.js";
import BackgroundStage from "./BackgroundStage.vue";
import CharacterSlot from "./CharacterSlot.vue";
import StatusBar from "./StatusBar.vue";
import DialogPanel from "./DialogPanel.vue";
import ChoicePanel from "./ChoicePanel.vue";
import SettingsPanel from "./SettingsPanel.vue";
import BgmPlayer from "./BgmPlayer.vue";

interface Character {
  id: string;
  label: string;
  assetPath: string | null;
}

interface Props {
  node: StoryNode | null;
  turnIndex: number;
  attitudeScore: number;
  attitudeMin: number;
  attitudeMax: number;
  view: TurnViewModel;
  character: Character | null;
  backgroundAssetPath?: string | null;
  bgm: BgmControllerState;
  bgmSrc?: string | null;
  settingsOpen: boolean;
  speakerLabel?: string;
}

interface Emits {
  (event: "retry"): void;
  (event: "skip"): void;
  (event: "choose", choice: ChoiceModel): void;
  (event: "open-settings"): void;
  (event: "close-settings"): void;
  (event: "toggle-bgm"): void;
  (event: "set-volume", value: number): void;
  (event: "bgm-source-resolved", available: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const backgroundPresentation = computed(() => {
  if (!props.node) {
    return resolveBackgroundPresentation(
      {
        id: "kunlun-empty",
        backgroundMode: "fictional",
        backgroundHint: "尚未加载主线内容。",
      },
      null,
    );
  }
  return resolveBackgroundPresentation(
    props.node,
    props.backgroundAssetPath ?? null,
  );
});

const characterPresentation = computed<CharacterPresentation | null>(() => {
  if (!props.character) {
    return null;
  }
  return resolveCharacterPresentation(
    props.character.id,
    props.character.label,
    props.character.assetPath,
  );
});

const alignChoice = computed<ChoiceModel | null>(
  () => props.view.choices.find((c) => c.id === "align") ?? null,
);
const challengeChoice = computed<ChoiceModel | null>(
  () => props.view.choices.find((c) => c.id === "challenge") ?? null,
);

useKeyboardControls(
  () => ({
    settingsOpen: props.settingsOpen,
    choicesReady:
      props.view.snapshot.state === "awaiting-choice" &&
      alignChoice.value !== null &&
      challengeChoice.value !== null,
    isRevealing: props.view.isRevealing,
  }),
  {
    onChooseAlign: () => {
      if (alignChoice.value) emit("choose", alignChoice.value);
    },
    onChooseChallenge: () => {
      if (challengeChoice.value) emit("choose", challengeChoice.value);
    },
    onSkip: () => emit("skip"),
    onCloseSettings: () => emit("close-settings"),
  },
);
</script>

<template>
  <main class="game-shell" data-testid="game-shell">
    <BackgroundStage :presentation="backgroundPresentation" />
    <CharacterSlot :presentation="characterPresentation" />

    <div class="game-shell__chrome">
      <StatusBar
        :node="node"
        :turn-index="turnIndex"
        :attitude-score="attitudeScore"
        :attitude-min="attitudeMin"
        :attitude-max="attitudeMax"
      />
      <button
        type="button"
        class="game-shell__settings-entry"
        data-testid="settings-open"
        aria-label="打开设置"
        @click="emit('open-settings')"
      >
        <span aria-hidden="true">⚙︎</span>
      </button>
    </div>

    <section class="game-shell__dialogue">
      <DialogPanel
        :view="view"
        :speaker-label="speakerLabel"
        @retry="emit('retry')"
        @skip="emit('skip')"
      />
      <ChoicePanel :view="view" @choose="(choice) => emit('choose', choice)" />
    </section>

    <BgmPlayer
      :state="bgm"
      :src="bgmSrc ?? null"
      @source-resolved="(value) => emit('bgm-source-resolved', value)"
    />

    <SettingsPanel
      :open="settingsOpen"
      :bgm="bgm"
      @close="emit('close-settings')"
      @toggle-bgm="emit('toggle-bgm')"
      @set-volume="(value) => emit('set-volume', value)"
    />
  </main>
</template>

<style scoped>
.game-shell {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  isolation: isolate;
}

.game-shell__chrome {
  position: relative;
  z-index: var(--z-panel);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.game-shell__settings-entry {
  margin: var(--space-4) var(--space-5) 0 0;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-muted);
  color: var(--color-foreground);
  cursor: pointer;
  font-size: var(--font-size-lg);
  transition:
    background var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
}

.game-shell__settings-entry:hover,
.game-shell__settings-entry:focus-visible {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--color-accent);
}

.game-shell__dialogue {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-panel);
  padding: var(--space-5) clamp(var(--space-5), 6vw, var(--space-7))
    var(--space-6);
  padding-right: max(
    clamp(var(--space-5), 6vw, var(--space-7)),
    var(--safe-right)
  );
  padding-left: max(
    clamp(var(--space-5), 6vw, var(--space-7)),
    var(--safe-left)
  );
  padding-bottom: calc(var(--space-6) + var(--safe-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (max-width: 720px) {
  .game-shell__dialogue {
    padding: var(--space-4);
    padding-right: max(var(--space-4), var(--safe-right));
    padding-left: max(var(--space-4), var(--safe-left));
    padding-bottom: calc(var(--space-4) + var(--safe-bottom));
  }
}

@media (max-width: 640px) {
  .game-shell__chrome {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
  .game-shell__settings-entry {
    align-self: flex-end;
    margin: 0 var(--space-4) 0 0;
    margin-right: max(var(--space-4), var(--safe-right));
  }
}
</style>
