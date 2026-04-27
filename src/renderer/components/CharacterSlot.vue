<script setup lang="ts">
import type { CharacterPresentation } from '../../presentation/assetSlotResolver.js'

interface Props {
  presentation: CharacterPresentation | null
}

defineProps<Props>()
</script>

<template>
  <div
    v-if="presentation"
    class="character-slot"
    :data-slot-id="presentation.slotId"
    :data-has-asset="presentation.hasRealAsset ? 'true' : 'false'"
  >
    <img
      v-if="presentation.hasRealAsset && presentation.assetPath"
      class="character-slot__image"
      :src="presentation.assetPath"
      :alt="presentation.placeholderLabel"
    />
    <div v-else class="character-slot__placeholder" aria-hidden="true">
      <div class="character-slot__silhouette" />
      <span class="character-slot__label" data-testid="character-label">
        {{ presentation.placeholderLabel }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.character-slot {
  position: absolute;
  right: 8%;
  bottom: calc(var(--dialogue-height, 280px) + var(--space-5));
  width: min(320px, 28vw);
  aspect-ratio: 3 / 4;
  z-index: var(--z-stage);
  pointer-events: none;
  transition: opacity var(--motion-slow) var(--ease-standard);
}

.character-slot__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 20px 32px rgba(0, 0, 0, 0.45));
}

.character-slot__placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
  border: 1px dashed rgba(216, 168, 79, 0.38);
  background: linear-gradient(
    180deg,
    rgba(248, 239, 222, 0.09),
    rgba(248, 239, 222, 0.02)
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: var(--space-4);
  gap: var(--space-3);
}

.character-slot__silhouette {
  flex: 1;
  width: 60%;
  background: linear-gradient(
    180deg,
    rgba(248, 239, 222, 0.24) 0%,
    rgba(216, 168, 79, 0.1) 70%,
    transparent 100%
  );
  clip-path: polygon(
    50% 0%,
    68% 14%,
    72% 34%,
    88% 46%,
    100% 100%,
    0% 100%,
    12% 46%,
    28% 34%,
    32% 14%
  );
}

.character-slot__label {
  font-family: var(--font-serif);
  font-size: var(--font-size-sm);
  color: rgba(255, 246, 232, 0.74);
  letter-spacing: 0.1em;
}
</style>
