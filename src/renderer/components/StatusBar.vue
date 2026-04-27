<script setup lang="ts">
import { computed } from "vue";
import { Gauge, ScrollText, Sparkles } from "lucide-vue-next";
import type { StoryNode } from "../../shared/contracts/contentContracts.js";

interface Props {
  node: StoryNode | null;
  turnIndex: number;
  attitudeScore: number;
  attitudeMin: number;
  attitudeMax: number;
  isFallbackModel?: boolean;
}

const props = defineProps<Props>();

const attitudeRange = computed(() => props.attitudeMax - props.attitudeMin);

const attitudePercent = computed(() => {
  if (attitudeRange.value === 0) {
    return 50;
  }
  const clamped = Math.min(
    props.attitudeMax,
    Math.max(props.attitudeMin, props.attitudeScore),
  );
  return ((clamped - props.attitudeMin) / attitudeRange.value) * 100;
});

const attitudeLabel = computed(() => {
  if (props.attitudeScore > 1) {
    return "亲近";
  }
  if (props.attitudeScore < -1) {
    return "傲娇";
  }
  return "平和";
});
</script>

<template>
  <aside class="status-bar" aria-label="当前进度与风格倾向">
    <div class="status-bar__node">
      <span class="status-bar__chapter" data-testid="status-node-theme">
        {{ node?.theme ?? "尚未进入主线" }}
      </span>
      <h1 class="status-bar__title" data-testid="status-node-title">
        {{ node?.title ?? "昆仑谣" }}
      </h1>
      <p class="status-bar__tone" v-if="node">{{ node.toneHint }}</p>
      <span
        v-if="isFallbackModel"
        class="status-bar__fallback-chip"
        data-testid="status-fallback-chip"
        title="当前运行在 qwen2.5-3b-instruct 兼容模式，单轮输出会稍慢、叙事密度略低。"
      >
        <Gauge :size="13" :stroke-width="1.8" aria-hidden="true" />
        Lite 模型 · 叙事密度已压缩
      </span>
    </div>

    <div class="status-bar__meta">
      <div class="status-bar__turn" data-testid="status-turn">
        <span class="status-bar__meta-label"><ScrollText :size="14" aria-hidden="true" />轮次</span>
        <span class="status-bar__meta-value">{{ turnIndex + 1 }}</span>
      </div>
      <div
        class="status-bar__attitude"
        :aria-label="`当前风格倾向：${attitudeLabel}`"
        data-testid="status-attitude"
      >
        <span class="status-bar__meta-label"><Sparkles :size="14" aria-hidden="true" />风格</span>
        <div class="status-bar__attitude-bar" aria-hidden="true">
          <div
            class="status-bar__attitude-fill"
            :style="{ width: `${attitudePercent}%` }"
          />
          <div class="status-bar__attitude-center" />
        </div>
        <span class="status-bar__attitude-label">{{ attitudeLabel }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-5);
  padding: var(--space-4) var(--space-6);
  padding-top: calc(var(--space-4) + var(--safe-top));
  padding-left: max(var(--space-6), var(--safe-left));
  padding-right: max(var(--space-6), var(--safe-right));
  background:
    linear-gradient(180deg, rgba(8, 19, 22, 0.82) 0%, rgba(8, 19, 22, 0.48) 72%, rgba(8, 19, 22, 0) 100%),
    repeating-linear-gradient(
      135deg,
        rgba(216, 168, 79, 0.06) 0,
        rgba(216, 168, 79, 0.06) 8px,
        rgba(255, 250, 247, 0) 8px,
        rgba(255, 250, 247, 0) 16px
    );
      color: var(--color-foreground-invert);
      backdrop-filter: blur(10px);
}

@media (max-width: 640px) {
  .status-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    padding-top: calc(var(--space-3) + var(--safe-top));
    padding-left: max(var(--space-4), var(--safe-left));
    padding-right: max(var(--space-4), var(--safe-right));
  }
  .status-bar__meta {
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .status-bar__attitude {
    min-width: 0;
    flex: 1 1 140px;
  }
}

.status-bar__chapter {
  display: block;
  font-size: var(--font-size-xs);
  letter-spacing: 0.24em;
  color: rgba(255, 246, 232, 0.66);
  margin-bottom: var(--space-1);
  font-family: var(--font-sans);
}

.status-bar__title {
  font-family: var(--font-serif);
  margin: 0;
  font-size: var(--font-size-xl);
  letter-spacing: 0.08em;
  color: var(--color-foreground-invert);
  text-wrap: balance;
}

.status-bar__tone {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-sm);
  color: rgba(255, 246, 232, 0.72);
}

.status-bar__fallback-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding: 2px 10px;
  border-radius: var(--radius-sm, 6px);
  background: rgba(216, 168, 79, 0.16);
  color: #ffe4a3;
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  border: 1px solid rgba(217, 119, 6, 0.35);
}

.status-bar__meta {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.status-bar__meta-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  letter-spacing: 0.18em;
  color: rgba(255, 246, 232, 0.68);
  margin-bottom: var(--space-1);
}

.status-bar__meta-value {
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
  color: var(--color-foreground-invert);
}

.status-bar__attitude {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 180px;
}

.status-bar__attitude-bar {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: rgba(248, 239, 222, 0.18);
  overflow: hidden;
}

.status-bar__attitude-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    var(--color-challenge) 0%,
    #d8a84f 50%,
    var(--color-align) 100%
  );
  transition: width var(--motion-base) var(--ease-standard);
}

.status-bar__attitude-center {
  position: absolute;
  top: -2px;
  bottom: -2px;
  left: calc(50% - 1px);
  width: 2px;
  background: rgba(255, 246, 232, 0.35);
}

.status-bar__attitude-label {
  font-size: var(--font-size-xs);
  color: rgba(255, 246, 232, 0.72);
  letter-spacing: 0.2em;
}
</style>
