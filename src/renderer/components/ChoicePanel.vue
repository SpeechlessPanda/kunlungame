<script setup lang="ts">
import { computed } from "vue";
import type {
  ChoiceModel,
  TurnViewModel,
} from "../composables/useTurnController.js";

interface Props {
  view: TurnViewModel;
}

interface Emits {
  (event: "choose", choice: ChoiceModel): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isReady = computed(
  () =>
    props.view.snapshot.state === "awaiting-choice" &&
    props.view.choices.length === 2,
);

const alignChoice = computed(
  () => props.view.choices.find((choice) => choice.id === "align") ?? null,
);

const challengeChoice = computed(
  () => props.view.choices.find((choice) => choice.id === "challenge") ?? null,
);

const statusMessage = computed(() => {
  if (isReady.value) {
    return "请选择本轮回应";
  }
  if (props.view.snapshot.state === "error") {
    return "模型出错，暂无选项";
  }
  return "选项将在讲述结束后出现";
});
</script>

<template>
  <section
    class="choice-panel"
    :data-ready="isReady ? 'true' : 'false'"
    aria-label="对话选项区"
  >
    <p
      v-if="!isReady"
      class="choice-panel__placeholder"
      data-testid="choice-placeholder"
    >
      {{ statusMessage }}
    </p>
    <div
      v-else
      class="choice-panel__buttons"
      role="group"
      aria-label="本轮两个回应"
    >
      <button
        v-if="alignChoice"
        type="button"
        class="choice-panel__button choice-panel__button--align"
        data-testid="choice-align"
        :aria-label="`顺从选项：${alignChoice.label}`"
        aria-keyshortcuts="1"
        @click="emit('choose', alignChoice)"
      >
        <span class="choice-panel__tag">顺从 · 1</span>
        <span class="choice-panel__label">{{ alignChoice.label }}</span>
      </button>
      <button
        v-if="challengeChoice"
        type="button"
        class="choice-panel__button choice-panel__button--challenge"
        data-testid="choice-challenge"
        :aria-label="`反驳选项：${challengeChoice.label}`"
        aria-keyshortcuts="2"
        @click="emit('choose', challengeChoice)"
      >
        <span class="choice-panel__tag">反驳 · 2</span>
        <span class="choice-panel__label">{{ challengeChoice.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.choice-panel {
  margin-top: var(--space-4);
  min-height: 96px;
  display: flex;
  align-items: stretch;
}

.choice-panel__placeholder {
  flex: 1;
  margin: 0;
  padding: var(--space-4) var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-foreground-dim);
  font-size: var(--font-size-sm);
  text-align: center;
  letter-spacing: 0.1em;
}

.choice-panel__buttons {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.choice-panel__button {
  min-height: 96px;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-muted);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  font-size: var(--font-size-md);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition:
    transform var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard),
    background var(--motion-fast) var(--ease-standard);
  touch-action: manipulation;
}

@media (prefers-reduced-motion: reduce) {
  .choice-panel__button {
    transition: none;
  }
  .choice-panel__button:hover,
  .choice-panel__button:focus-visible,
  .choice-panel__button:active {
    transform: none;
  }
}

.choice-panel__button:hover,
.choice-panel__button:focus-visible {
  transform: translateY(-1px);
  box-shadow: var(--shadow-pop);
}

.choice-panel__button:active {
  transform: translateY(0);
}

.choice-panel__button--align {
  border-color: var(--color-align-border);
}

.choice-panel__button--align:hover,
.choice-panel__button--align:focus-visible {
  background: rgba(63, 154, 106, 0.18);
  border-color: var(--color-align);
}

.choice-panel__button--challenge {
  border-color: var(--color-challenge-border);
}

.choice-panel__button--challenge:hover,
.choice-panel__button--challenge:focus-visible {
  background: rgba(197, 90, 72, 0.18);
  border-color: var(--color-challenge);
}

.choice-panel__tag {
  display: inline-block;
  align-self: flex-start;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  letter-spacing: 0.18em;
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-foreground-muted);
}

.choice-panel__button--align .choice-panel__tag {
  color: var(--color-align);
}

.choice-panel__button--challenge .choice-panel__tag {
  color: var(--color-challenge);
}

.choice-panel__label {
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

@media (max-width: 720px) {
  .choice-panel__buttons {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .choice-panel {
    min-height: auto;
  }
  .choice-panel__button {
    /* 保证移动端点击命中 ≥56px，同时视觉上仍保留留白 */
    min-height: var(--tap-target-choice);
    padding: var(--space-3) var(--space-4);
    gap: var(--space-1);
  }
}
</style>
