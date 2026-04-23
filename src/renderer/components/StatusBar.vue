<script setup lang="ts">
import { computed } from 'vue'
import type { StoryNode } from '../../shared/contracts/contentContracts.js'

interface Props {
  node: StoryNode | null
  turnIndex: number
  attitudeScore: number
  attitudeMin: number
  attitudeMax: number
}

const props = defineProps<Props>()

const attitudeRange = computed(() => props.attitudeMax - props.attitudeMin)

const attitudePercent = computed(() => {
  if (attitudeRange.value === 0) {
    return 50
  }
  const clamped = Math.min(
    props.attitudeMax,
    Math.max(props.attitudeMin, props.attitudeScore)
  )
  return ((clamped - props.attitudeMin) / attitudeRange.value) * 100
})

const attitudeLabel = computed(() => {
  if (props.attitudeScore > 1) {
    return '亲近'
  }
  if (props.attitudeScore < -1) {
    return '傲娇'
  }
  return '平和'
})
</script>

<template>
  <aside class="status-bar" aria-label="当前进度与风格倾向">
    <div class="status-bar__node">
      <span class="status-bar__chapter" data-testid="status-node-theme">
        {{ node?.theme ?? '尚未进入主线' }}
      </span>
      <h1 class="status-bar__title" data-testid="status-node-title">
        {{ node?.title ?? '昆仑谣' }}
      </h1>
      <p class="status-bar__tone" v-if="node">{{ node.toneHint }}</p>
    </div>

    <div class="status-bar__meta">
      <div class="status-bar__turn" data-testid="status-turn">
        <span class="status-bar__meta-label">轮次</span>
        <span class="status-bar__meta-value">{{ turnIndex + 1 }}</span>
      </div>
      <div
        class="status-bar__attitude"
        :aria-label="`当前风格倾向：${attitudeLabel}`"
        data-testid="status-attitude"
      >
        <span class="status-bar__meta-label">风格</span>
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
  background: linear-gradient(
    180deg,
    rgba(9, 14, 28, 0.85) 0%,
    rgba(9, 14, 28, 0) 100%
  );
}

.status-bar__chapter {
  display: block;
  font-size: var(--font-size-xs);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--color-foreground-dim);
  margin-bottom: var(--space-1);
}

.status-bar__title {
  font-family: var(--font-serif);
  margin: 0;
  font-size: var(--font-size-xl);
  letter-spacing: 0.08em;
  color: var(--color-foreground);
}

.status-bar__tone {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-foreground-muted);
}

.status-bar__meta {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.status-bar__meta-label {
  display: block;
  font-size: var(--font-size-xs);
  letter-spacing: 0.18em;
  color: var(--color-foreground-dim);
  margin-bottom: var(--space-1);
}

.status-bar__meta-value {
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
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
  background: rgba(255, 255, 255, 0.08);
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
    var(--color-accent) 50%,
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
  background: rgba(255, 255, 255, 0.25);
}

.status-bar__attitude-label {
  font-size: var(--font-size-xs);
  color: var(--color-foreground-muted);
  letter-spacing: 0.2em;
}
</style>
