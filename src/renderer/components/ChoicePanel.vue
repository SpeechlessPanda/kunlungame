<script setup lang="ts">
import { computed } from "vue";
import { MessageCircleQuestion, Sparkle } from "lucide-vue-next";
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
        :aria-label="`第一个回应：${alignChoice.label}`"
        aria-keyshortcuts="1"
        @click="emit('choose', alignChoice)"
      >
        <span class="choice-panel__tag" aria-hidden="true">
          <Sparkle :size="16" :stroke-width="1.9" />
        </span>
        <span class="choice-panel__label">{{ alignChoice.label }}</span>
      </button>
      <button
        v-if="challengeChoice"
        type="button"
        class="choice-panel__button choice-panel__button--challenge"
        data-testid="choice-challenge"
        :aria-label="`第二个回应：${challengeChoice.label}`"
        aria-keyshortcuts="2"
        @click="emit('choose', challengeChoice)"
      >
        <span class="choice-panel__tag" aria-hidden="true">
          <MessageCircleQuestion :size="16" :stroke-width="1.9" />
        </span>
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
  color: rgba(255, 246, 232, 0.72);
  font-size: var(--font-size-sm);
  text-align: center;
  letter-spacing: 0.1em;
  background: rgba(16, 27, 30, 0.44);
  backdrop-filter: blur(8px);
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
  background: var(--color-surface);
  color: var(--color-foreground);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-shadow: var(--shadow-soft);
  transition:
    transform var(--motion-base) var(--ease-bouncy),
    border-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard),
    background var(--motion-fast) var(--ease-standard);
  touch-action: manipulation;
  position: relative;
  overflow: hidden;
}

.choice-panel__button::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(220px 80px at 16% 0%, rgba(255, 255, 255, 0.28), transparent 70%),
    repeating-linear-gradient(
      -30deg,
      rgba(255, 255, 255, 0.12) 0,
      rgba(255, 255, 255, 0.12) 2px,
      transparent 2px,
      transparent 10px
    );
  opacity: 0.45;
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
  transform: translateY(-3px) scale(1.015);
  box-shadow: var(--shadow-pop);
}

.choice-panel__button:active {
  transform: translateY(0) scale(0.99);
}

.choice-panel__button--align {
  border-color: var(--color-align-border);
  background: var(--color-align-bg);
}

.choice-panel__button--align:hover,
.choice-panel__button--align:focus-visible {
  background: #d8f3e5;
  border-color: var(--color-align);
}

.choice-panel__button--challenge {
  border-color: var(--color-challenge-border);
  background: var(--color-challenge-bg);
}

.choice-panel__button--challenge:hover,
.choice-panel__button--challenge:focus-visible {
  background: #fbdccf;
  border-color: var(--color-challenge);
}

.choice-panel__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 700;
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-foreground-muted);
}

.choice-panel__button--align .choice-panel__tag {
  color: var(--color-align);
}

.choice-panel__button--challenge .choice-panel__tag {
  color: var(--color-challenge);
}

.choice-panel__label {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  line-height: 1.45;
  color: var(--color-foreground);
  position: relative;
  z-index: 1;
}

@media (max-width: 720px) {
  .choice-panel__buttons {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) and (min-width: 641px) {
  .choice-panel__buttons {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
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

@media (max-width: 360px) {
  .choice-panel__label {
    font-size: var(--font-size-md);
  }
}
</style>
