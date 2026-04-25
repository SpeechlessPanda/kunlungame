<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

/**
 * 主线最终节点跑完后的"升华 + 谢幕"覆盖层。
 *
 * 设计目标：
 *   1. 给玩家一个明显的"游戏结束"信号（淡入金色幕布、字幕谢幕动画），
 *      避免过去那种"在最后一轮选项里反复点击"的体感。
 *   2. 提供两个明确出口：再走一次旅程 / 退出游戏；不再用普通 align/challenge 选项
 *      偷偷重置主线。
 *   3. 根据玩家最终态度值给出三种语调略不同的尾声文本，让"我做过的选择"
 *      在结尾被回应到。
 *
 * 该组件不直接调用任何 IPC，重启 / 退出由父组件回调处理；这样 SSR/测试也方便。
 */

interface Props {
  open: boolean;
  attitudeScore: number;
  /** 玩家本次旅程一共走过的节点标题，用于"谢幕字幕"展示。 */
  visitedNodeTitles: string[];
  /** 当前是否运行在桌面壳里——浏览器预览下隐藏退出按钮。 */
  canQuit: boolean;
}

interface Emits {
  (event: "restart"): void;
  (event: "quit"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const overlayRoot = ref<HTMLDivElement | null>(null);
const restartButtonRef = ref<HTMLButtonElement | null>(null);

const epilogueLines = computed<string[]>(() => {
  if (props.attitudeScore >= 2) {
    return [
      "你一路上都顺着昆仑的话往下走，",
      "你听见的是同一条文明缓慢、温柔地醒过来。",
      "谢谢你愿意做那个一直在听的人。",
    ];
  }
  if (props.attitudeScore <= -2) {
    return [
      "你一路上都在质疑、追问、不肯轻易点头，",
      "于是这条文明在你这里被重新摆了一次。",
      "谢谢你愿意较真——这才是文化要的样子。",
    ];
  }
  return [
    "你既接住过昆仑，也反驳过昆仑，",
    "于是这八节文明记忆被你共同重写了一遍。",
    "谢谢你愿意走完这条回廊。",
  ];
});

const closingTitle = computed<string>(() => {
  if (props.attitudeScore >= 2) {
    return "旅程谢幕 · 顺流而下";
  }
  if (props.attitudeScore <= -2) {
    return "旅程谢幕 · 较真而行";
  }
  return "旅程谢幕 · 共写一遍";
});

const onRestart = (): void => {
  emit("restart");
};

const onQuit = (): void => {
  emit("quit");
};

const onKeydown = (event: KeyboardEvent): void => {
  if (!props.open) {
    return;
  }
  if (event.key === "Tab") {
    // 简单的焦点环：只在两个按钮间循环。
    const focusable = overlayRoot.value?.querySelectorAll<HTMLButtonElement>(
      "button[data-overlay-focusable='true']",
    );
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
};

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  // 自动把焦点放到"再走一次旅程"，方便键盘玩家直接回车继续。
  setTimeout(() => {
    if (props.open) {
      restartButtonRef.value?.focus();
    }
  }, 60);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div
    v-if="open"
    ref="overlayRoot"
    class="ending-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ending-overlay-title"
    data-testid="ending-overlay"
  >
    <div class="ending-overlay__veil" aria-hidden="true" />
    <div class="ending-overlay__panel">
      <h2
        id="ending-overlay-title"
        class="ending-overlay__title"
        data-testid="ending-overlay-title"
      >
        {{ closingTitle }}
      </h2>
      <p
        v-for="(line, index) in epilogueLines"
        :key="index"
        class="ending-overlay__line"
        :style="{ animationDelay: `${0.4 + index * 0.6}s` }"
      >
        {{ line }}
      </p>
      <ol
        v-if="visitedNodeTitles.length > 0"
        class="ending-overlay__credits"
        aria-label="本次旅程走过的节点"
        data-testid="ending-overlay-credits"
      >
        <li
          v-for="(title, index) in visitedNodeTitles"
          :key="title"
          :style="{ animationDelay: `${1.6 + index * 0.18}s` }"
        >
          {{ title }}
        </li>
      </ol>
      <div class="ending-overlay__actions">
        <button
          ref="restartButtonRef"
          type="button"
          class="ending-overlay__button ending-overlay__button--primary"
          data-overlay-focusable="true"
          data-testid="ending-overlay-restart"
          @click="onRestart"
        >
          再走一次旅程
        </button>
        <button
          v-if="canQuit"
          type="button"
          class="ending-overlay__button ending-overlay__button--ghost"
          data-overlay-focusable="true"
          data-testid="ending-overlay-quit"
          @click="onQuit"
        >
          退出游戏
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ending-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.ending-overlay__veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 35%,
    rgba(255, 235, 196, 0.55) 0%,
    rgba(60, 40, 25, 0.92) 70%,
    rgba(20, 14, 8, 0.98) 100%
  );
  animation: endingVeilIn 1200ms ease-out forwards;
}

.ending-overlay__panel {
  position: relative;
  max-width: min(640px, 92vw);
  padding: clamp(24px, 4vw, 48px);
  text-align: center;
  color: #fdf3df;
  font-family: var(--font-serif, "Noto Serif SC", "Songti SC", serif);
  animation: endingPanelIn 1400ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.ending-overlay__title {
  font-size: clamp(28px, 4vw, 40px);
  letter-spacing: 0.08em;
  margin: 0 0 24px;
  color: #f5c97c;
  text-shadow: 0 0 18px rgba(245, 201, 124, 0.35);
}

.ending-overlay__line {
  margin: 12px 0;
  font-size: clamp(16px, 1.6vw, 19px);
  line-height: 1.9;
  opacity: 0;
  animation: endingLineIn 800ms ease-out forwards;
}

.ending-overlay__credits {
  list-style: none;
  margin: 28px 0 24px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 6px 18px;
  font-size: 13px;
  color: rgba(253, 243, 223, 0.78);
}

.ending-overlay__credits li {
  opacity: 0;
  animation: endingLineIn 600ms ease-out forwards;
}

.ending-overlay__actions {
  margin-top: 32px;
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.ending-overlay__button {
  min-height: 44px;
  padding: 10px 22px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    background 200ms ease,
    border-color 200ms ease,
    transform 120ms ease;
}

.ending-overlay__button--primary {
  background: linear-gradient(180deg, #f5c97c, #d29442);
  color: #2c1d0a;
  border: 1px solid rgba(255, 235, 196, 0.6);
  box-shadow: 0 6px 24px rgba(210, 148, 66, 0.35);
}

.ending-overlay__button--primary:hover,
.ending-overlay__button--primary:focus-visible {
  transform: translateY(-1px);
  background: linear-gradient(180deg, #ffd690, #e5a14c);
}

.ending-overlay__button--ghost {
  background: transparent;
  color: #fdf3df;
  border: 1px solid rgba(253, 243, 223, 0.55);
}

.ending-overlay__button--ghost:hover,
.ending-overlay__button--ghost:focus-visible {
  background: rgba(253, 243, 223, 0.12);
  border-color: rgba(253, 243, 223, 0.85);
}

@keyframes endingVeilIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes endingPanelIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes endingLineIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
