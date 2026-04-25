<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { TurnViewModel } from "../composables/useTurnController.js";

interface Props {
  view: TurnViewModel;
  speakerLabel?: string;
}

interface Emits {
  (event: "retry"): void;
  (event: "skip"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const bodyRef = ref<HTMLDivElement | null>(null);

/** 流式追加时自动滚到底，保证用户永远看到最新讲出来的那句；
 *  静态展示时不动，让用户能向上回读。 */
watch(
  () => props.view.visibleText,
  async () => {
    if (!props.view.isRevealing) return;
    await nextTick();
    const el = bodyRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  },
);

const stateLabel = computed(() => {
  switch (props.view.snapshot.state) {
    case "idle":
      return "等待开启";
    case "loading":
      return "正在唤起记忆…";
    case "streaming":
      return props.view.isRevealing ? "讲述中…" : "讲述完毕";
    case "awaiting-choice":
      return "等待你的回应";
    case "error":
      return "出现问题";
    default:
      return "";
  }
});

const showEmptyState = computed(
  () =>
    props.view.snapshot.state === "idle" && props.view.fullText.length === 0,
);

const showLoadingSkeleton = computed(
  () =>
    props.view.snapshot.state === "loading" &&
    props.view.visibleText.length === 0,
);

const showErrorState = computed(() => props.view.snapshot.state === "error");
</script>

<template>
  <section
    class="dialog-panel"
    :data-state="view.snapshot.state"
    aria-live="polite"
    aria-atomic="false"
  >
    <div class="dialog-panel__nameplate" aria-hidden="true">
      <span class="dialog-panel__heart">♡</span>
      <span class="dialog-panel__nameplate-text">{{
        speakerLabel ?? "昆仑"
      }}</span>
    </div>

    <header class="dialog-panel__header">
      <span class="dialog-panel__speaker sr-only">{{
        speakerLabel ?? "昆仑"
      }}</span>
      <span class="dialog-panel__state" data-testid="dialog-state">{{
        stateLabel
      }}</span>
    </header>

    <div
      v-if="showEmptyState"
      class="dialog-panel__empty"
      data-testid="dialog-empty"
    >
      <p>诶——第一次见面呢。点一下下面的「进入昆仑」，我们慢慢聊。</p>
    </div>

    <div
      v-else-if="showErrorState"
      class="dialog-panel__error"
      role="alert"
      data-testid="dialog-error"
    >
      <p class="dialog-panel__error-text">
        {{ view.snapshot.errorMessage ?? "唔，我这里卡住了，重试一下？" }}
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

    <div
      v-else-if="showLoadingSkeleton"
      class="dialog-panel__skeleton"
      aria-hidden="true"
    >
      <span class="dialog-panel__skeleton-line" />
      <span
        class="dialog-panel__skeleton-line dialog-panel__skeleton-line--short"
      />
      <span class="dialog-panel__skeleton-line" />
    </div>

    <div v-else class="dialog-panel__body" ref="bodyRef">
      <p class="dialog-panel__text" data-testid="dialog-text">
        <span>{{ view.visibleText }}</span>
        <span
          v-if="view.isRevealing"
          class="dialog-panel__cursor"
          aria-hidden="true"
          >▍</span
        >
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
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-6) var(--space-6) var(--space-5);
  box-shadow: var(--shadow-surface);
  /* 自适应高度：正文短时塌到 ~180px，长时可以撑开到屏幕高度的 55%，
     再多就在内部滚，避免把角色立绘和状态栏都挤掉。 */
  min-height: clamp(180px, 22vh, 240px);
  max-height: min(55vh, 520px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  color: var(--color-foreground);
  margin-top: var(--space-5);
  transition: max-height var(--motion-slow) var(--ease-standard);
}

/* galgame 风的名字牌：从对话框左上角翘起来一截 */
.dialog-panel__nameplate {
  position: absolute;
  top: -20px;
  left: var(--space-5);
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--color-accent) 0%,
    var(--color-accent-strong) 100%
  );
  color: var(--color-accent-contrast);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  font-weight: 600;
  letter-spacing: 0.1em;
  box-shadow: var(--shadow-pop);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
}

.dialog-panel__heart {
  font-size: var(--font-size-sm);
  color: #fff;
  opacity: 0.85;
  transform: translateY(-1px);
}

.dialog-panel__header {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  font-size: var(--font-size-sm);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.dialog-panel__state {
  color: var(--color-foreground-dim);
  font-size: var(--font-size-xs);
  letter-spacing: 0.12em;
  font-family: var(--font-sans);
}

.dialog-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  /* 让文本区成为真正的滚动容器：flex:1 + min-height:0 是 flex 布局下滚动的标配。 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* 粉色细滚动条，避免破坏可爱风 */
  scrollbar-width: thin;
  scrollbar-color: var(--color-accent) transparent;
}

.dialog-panel__body::-webkit-scrollbar {
  width: 6px;
}

.dialog-panel__body::-webkit-scrollbar-thumb {
  background: var(--color-accent);
  border-radius: var(--radius-pill);
}

.dialog-panel__body::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-panel__text {
  margin: 0;
  font-size: var(--font-size-lg);
  line-height: var(--line-height-body);
  font-family: var(--font-display);
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-foreground);
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
  color: var(--color-accent-strong);
  border: 1.5px solid var(--color-accent);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-bouncy);
  min-height: 44px;
}

.dialog-panel__retry:hover,
.dialog-panel__retry:focus-visible,
.dialog-panel__skip:hover,
.dialog-panel__skip:focus-visible {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  transform: translateY(-1px);
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
    rgba(236, 125, 157, 0.1) 0%,
    rgba(236, 125, 157, 0.28) 50%,
    rgba(236, 125, 157, 0.1) 100%
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
