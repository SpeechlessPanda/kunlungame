<script setup lang="ts">
import { computed } from "vue";
import type { BackgroundPresentation } from "../../presentation/assetSlotResolver.js";

interface Props {
  presentation: BackgroundPresentation;
}

const props = defineProps<Props>();

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
    <div class="background-stage__mode-overlay">
      <span class="background-stage__mode" data-testid="background-mode-label">
        {{ modeLabel }}
      </span>
    </div>
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

/* 可爱风统一调：无论节点配的原始背景多冷多深，这里叠一层粉紫奶油的暖纱，
   让舞台整体和 UI 同一个 mood，而不是画面一半冷一半暖。 */
.background-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      1200px 600px at 15% 10%,
      rgba(236, 125, 157, 0.35),
      transparent 70%
    ),
    radial-gradient(
      900px 600px at 85% 90%,
      rgba(255, 226, 236, 0.55),
      transparent 65%
    ),
    linear-gradient(
      180deg,
      rgba(253, 245, 241, 0.45) 0%,
      rgba(253, 245, 241, 0.2) 60%,
      rgba(253, 245, 241, 0.55) 100%
    );
  mix-blend-mode: screen;
}

.background-stage__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(0.78) brightness(1.08);
}

.background-stage__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}

.background-stage__hint {
  max-width: 520px;
  padding: var(--space-4) var(--space-5);
  text-align: center;
  color: var(--color-foreground-muted);
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
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  background: rgba(255, 250, 247, 0.78);
  backdrop-filter: blur(6px);
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
    rgba(0, 0, 0, 0.55) 100%
  );
}
</style>
