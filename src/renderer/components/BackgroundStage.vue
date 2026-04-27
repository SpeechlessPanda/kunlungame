<script setup lang="ts">
import { computed } from "vue";
import type { BackgroundPresentation } from "../../presentation/assetSlotResolver.js";

interface Props {
  presentation: BackgroundPresentation;
}

const props = defineProps<Props>();
const sceneKey = computed(() => props.presentation.slot.slotId);

const gradientStyle = computed(() => {
  switch (props.presentation.paletteToken) {
    case "palette-myth":
      return "linear-gradient(140deg, var(--palette-myth-from), var(--palette-myth-to))";
    case "palette-heritage":
      return "linear-gradient(140deg, var(--palette-heritage-from), var(--palette-heritage-to))";
    case "palette-bridge":
      return "linear-gradient(140deg, var(--palette-bridge-from), var(--palette-bridge-to))";
    default:
      return "linear-gradient(140deg, #111, #000)";
  }
});

const modeLabel = computed(() => {
  switch (props.presentation.slot.mode) {
    case "fictional":
      return "虚构意象";
    case "photographic":
      return "实景照片";
    case "composite":
      return "虚实复合";
    default:
      return "未知模式";
  }
});
</script>

<template>
  <div
    class="background-stage"
    :data-mode="presentation.slot.mode"
    :data-has-asset="presentation.hasRealAsset ? 'true' : 'false'"
    role="img"
    :aria-label="`背景模式：${modeLabel}。${presentation.placeholderText}`"
  >
    <Transition name="stage-fade" mode="out-in">
      <div class="background-stage__frame" :key="sceneKey">
        <img
          v-if="presentation.hasRealAsset && presentation.slot.assetPath"
          class="background-stage__image"
          :src="presentation.slot.assetPath"
          :alt="presentation.placeholderText"
        />
        <div
          v-else
          class="background-stage__placeholder"
          :style="{ background: gradientStyle }"
        >
          <div class="background-stage__hint">
            <p class="background-stage__text" data-testid="background-hint">
              {{ presentation.placeholderText }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
    <div class="background-stage__mode-overlay">
      <span class="background-stage__mode" data-testid="background-mode-label">
        {{ modeLabel }}
      </span>
    </div>
    <div class="background-stage__petal-haze" aria-hidden="true" />
    <div class="background-stage__vignette" aria-hidden="true" />
  </div>
</template>

<style scoped>
.background-stage {
  position: absolute;
  inset: 0;
  z-index: var(--z-background);
  overflow: hidden;
  isolation: isolate;
  transition: opacity var(--motion-slow) var(--ease-standard);
}

.background-stage__frame {
  position: absolute;
  inset: 0;
}

.stage-fade-enter-active,
.stage-fade-leave-active {
  transition:
    opacity var(--motion-slow) var(--ease-standard),
    transform var(--motion-slow) var(--ease-standard);
}

.stage-fade-enter-from,
.stage-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

.background-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      1200px 600px at 15% 10%,
      rgba(216, 168, 79, 0.28),
      transparent 70%
    ),
    radial-gradient(
      900px 600px at 85% 90%,
      rgba(36, 116, 95, 0.22),
      transparent 65%
    ),
    linear-gradient(
      180deg,
      rgba(9, 19, 22, 0.18) 0%,
      rgba(9, 19, 22, 0.1) 48%,
      rgba(9, 19, 22, 0.76) 100%
    );
  mix-blend-mode: normal;
}

.background-stage__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(0.86) brightness(0.82) contrast(1.08);
}

.background-stage__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
}

.background-stage__placeholder::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 0 49%, rgba(255, 246, 232, 0.12) 49% 51%, transparent 51% 100%),
    repeating-linear-gradient(0deg, rgba(255, 246, 232, 0.05) 0, rgba(255, 246, 232, 0.05) 1px, transparent 1px, transparent 24px);
  opacity: 0.55;
}

.background-stage__hint {
  max-width: 520px;
  padding: var(--space-4) var(--space-5);
  text-align: center;
  color: rgba(255, 246, 232, 0.78);
  font-family: var(--font-serif);
  letter-spacing: 0.08em;
}

.background-stage__mode-overlay {
  position: absolute;
  top: var(--space-5);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  pointer-events: none;
}

.background-stage__mode {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border: 1px solid rgba(216, 168, 79, 0.42);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-foreground-invert);
  background: rgba(9, 19, 22, 0.56);
  backdrop-filter: blur(6px);
}

.background-stage__petal-haze {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      3px 3px at 12% 20%,
      rgba(216, 168, 79, 0.42),
      transparent 60%
    ),
    radial-gradient(
      2px 2px at 30% 68%,
      rgba(248, 239, 222, 0.3),
      transparent 60%
    ),
    radial-gradient(
      4px 4px at 82% 26%,
      rgba(36, 116, 95, 0.38),
      transparent 60%
    );
  opacity: 0.65;
}

.background-stage[data-mode="fictional"] .background-stage__petal-haze {
  opacity: 0.75;
}

.background-stage[data-mode="composite"] .background-stage__petal-haze {
  opacity: 0.48;
}

.background-stage[data-mode="photographic"] .background-stage__petal-haze {
  opacity: 0.22;
}

.background-stage__text {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-body);
  margin: 0;
}

.background-stage__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0) 55%,
    rgba(0, 0, 0, 0.72) 100%
  );
}
</style>
