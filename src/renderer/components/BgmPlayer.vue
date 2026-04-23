<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { BgmControllerState } from '../../presentation/bgmController.js'
import { isAudible } from '../../presentation/bgmController.js'

interface Props {
  state: BgmControllerState
  src: string | null
}

interface Emits {
  (event: 'source-resolved', available: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const audioRef = ref<HTMLAudioElement | null>(null)
const failed = ref(false)

const resolvedSrc = computed(() => {
  if (!props.src) {
    return null
  }
  if (failed.value) {
    return null
  }
  return props.src
})

const applyAudibility = (): void => {
  const el = audioRef.value
  if (!el) {
    return
  }
  el.volume = props.state.volume
  if (isAudible(props.state)) {
    void el.play().catch(() => {
      failed.value = true
      emit('source-resolved', false)
    })
  } else {
    el.pause()
  }
}

const handleLoaded = (): void => {
  failed.value = false
  emit('source-resolved', true)
  applyAudibility()
}

const handleError = (): void => {
  failed.value = true
  emit('source-resolved', false)
}

watch(
  () => [props.state.enabled, props.state.volume, props.state.sourceAvailable, resolvedSrc.value] as const,
  () => {
    applyAudibility()
  }
)

onBeforeUnmount(() => {
  if (audioRef.value) {
    audioRef.value.pause()
  }
})
</script>

<template>
  <audio
    v-if="resolvedSrc"
    ref="audioRef"
    class="bgm-player"
    :src="resolvedSrc"
    loop
    preload="auto"
    data-testid="bgm-audio"
    @loadeddata="handleLoaded"
    @error="handleError"
  />
</template>

<style scoped>
.bgm-player {
  display: none;
}
</style>
