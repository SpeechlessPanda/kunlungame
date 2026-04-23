<script setup lang="ts">
import { computed } from 'vue'
import type { TurnViewModel } from '../composables/useTurnController.js'

interface Props {
  view: TurnViewModel
  speakerLabel?: string
}

interface Emits {
  (event: 'retry'): void
  (event: 'skip'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const stateLabel = computed(() => {
  switch (props.view.snapshot.state) {
    case 'idle':
      return '等待开启'
    case 'loading':
      return '正在唤起记忆…'
    case 'streaming':
      return props.view.isRevealing ? '讲述中…' : '讲述完毕'
    case 'awaiting-choice':
      return '等待你的回应'
    case 'error':
      return '出现问题'
    default:
      return ''
  }
})

const showEmptyState = computed(
  () =>
    props.view.snapshot.state === 'idle' &&
    props.view.fullText.length === 0
)

const showLoadingSkeleton = computed(
  () =>
    props.view.snapshot.state === 'loading' &&
    props.view.visibleText.length === 0
)

const showErrorState = computed(() => props.view.snapshot.state === 'error')
</script>

<template>
  <section
    class="dialog-panel"
    :data-state="view.snapshot.state"
    aria-live="polite"
    aria-atomic="false"
  >
    <header class="dialog-panel__header">
      <span class="dialog-panel__speaker">{{ speakerLabel ?? '叙述者' }}</span>
      <span class="dialog-panel__state" data-testid="dialog-state">{{ stateLabel }}</span>
    </header>

    <div v-if="showEmptyState" class="dialog-panel__empty" data-testid="dialog-empty">
      <p>旅人，点击下方“继续”开始昆仑之上的第一段对话。</p>
    </div>

    <div v-else-if="showErrorState" class="dialog-panel__error" role="alert" data-testid="dialog-error">
      <p class="dialog-panel__error-text">
        {{ view.snapshot.errorMessage ?? '模型暂时无法回答，请稍后重试。' }}
      </p>
      <button
        type="button"
        class="dialog-panel__retry"
        data-testid="dialog-retry"
        @click="emit('retry')"
      >
        重试这一轮
      </button>
    </div>

    <div v-else-if="showLoadingSkeleton" class="dialog-panel__skeleton" aria-hidden="true">
      <span class="dialog-panel__skeleton-line" />
      <span class="dialog-panel__skeleton-line dialog-panel__skeleton-line--short" />
      <span class="dialog-panel__skeleton-line" />
    </div>

    <div v-else class="dialog-panel__body">
      <p class="dialog-panel__text" data-testid="dialog-text">
        <span>{{ view.visibleText }}</span>
        <span
          v-if="view.isRevealing"
          class="dialog-panel__cursor"
          aria-hidden="true"
        >▍</span>
      </p>
      <button
        v-if="view.isRevealing"
        type="button"
        class="dialog-panel__skip"
        data-testid="dialog-skip"
        @click="emit('skip')"
      >
        跳过动画
      </button>
    </div>
  </section>
</template>

<style scoped>
.dialog-panel {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: var(--shadow-surface);
  min-height: 220px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  color: var(--color-foreground);
}

.dialog-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--font-size-sm);
}

.dialog-panel__speaker {
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
  letter-spacing: 0.08em;
  color: var(--color-foreground);
}

.dialog-panel__state {
  color: var(--color-foreground-dim);
  font-size: var(--font-size-xs);
  letter-spacing: 0.12em;
}

.dialog-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dialog-panel__text {
  margin: 0;
  font-size: var(--font-size-lg);
  line-height: var(--line-height-body);
  font-family: var(--font-serif);
  white-space: pre-wrap;
  word-break: break-word;
}

.dialog-panel__cursor {
  display: inline-block;
  margin-left: 2px;
  color: var(--color-accent);
  animation: dialog-cursor-blink 900ms steps(2, start) infinite;
}

@keyframes dialog-cursor-blink {
  to {
    visibility: hidden;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-panel__cursor {
    animation: none;
  }
}

.dialog-panel__empty,
.dialog-panel__error {
  color: var(--color-foreground-muted);
  font-size: var(--font-size-md);
}

.dialog-panel__error {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.dialog-panel__error-text {
  margin: 0;
  color: var(--color-danger);
}

.dialog-panel__retry,
.dialog-panel__skip {
  align-self: flex-start;
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
  min-height: 40px;
}

.dialog-panel__retry:hover,
.dialog-panel__retry:focus-visible,
.dialog-panel__skip:hover,
.dialog-panel__skip:focus-visible {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.dialog-panel__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dialog-panel__skeleton-line {
  display: block;
  height: 14px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.14) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: dialog-shimmer 1600ms linear infinite;
}

.dialog-panel__skeleton-line--short {
  width: 60%;
}

@keyframes dialog-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-panel__skeleton-line {
    animation: none;
  }
}
</style>
