<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  ATTITUDE_MAX,
  ATTITUDE_MIN
} from '../runtime/runtimeState.js'
import {
  minimalStoryOutline,
  type StoryNode
} from '../shared/contracts/contentContracts.js'
import {
  createBgmController,
  type BgmControllerState
} from '../presentation/bgmController.js'
import GameShell from './components/GameShell.vue'
import {
  createTurnController,
  type ChoiceModel
} from './composables/useTurnController.js'

// --- 演示用节点（未接入真实主线前的回退内容） -------------------------------
const demoNodes: StoryNode[] = [
  minimalStoryOutline.nodes[0]!,
  {
    id: 'kunlun-rites',
    title: '礼乐之径',
    theme: '礼乐文明',
    summary: '从神话边界过渡到礼乐文明的历史现场。',
    retrievalKeywords: ['礼乐', '周礼', '编钟'],
    backgroundMode: 'photographic',
    backgroundHint: '青铜编钟与朱漆礼器陈列在博物馆灯光下。',
    toneHint: '沉稳、克制、略带敬畏。',
    nextNodeId: null
  },
  {
    id: 'kunlun-dialogue',
    title: '今古对谈',
    theme: '现代转化',
    summary: '神话与今天的日常生活在同一个画面里并置。',
    retrievalKeywords: ['现代', '传统', '转化'],
    backgroundMode: 'composite',
    backgroundHint: '夜色中的城市天际线与昆仑雪山叠印。',
    toneHint: '好奇、清醒、对话式。',
    nextNodeId: null
  }
]

const nodeIndex = ref(0)
const currentNode = computed<StoryNode | null>(() => demoNodes[nodeIndex.value] ?? null)

const turnIndex = ref(0)
const attitudeScore = ref(0)

const turn = createTurnController()

const bgm = createBgmController({ enabled: true })
const bgmState = ref<BgmControllerState>(bgm.snapshot())
const bgmSrc = ref<string | null>(null)

const refreshBgm = (next: BgmControllerState): void => {
  bgmState.value = next
}

const settingsOpen = ref(false)

const sampleNarratives: Record<string, string[]> = {
  'kunlun-prologue': [
    '云海之间，',
    '一道昆仑的轮廓渐渐自寒气里浮现。',
    '你听见山口传来风声，仿佛有人在等你开口。'
  ],
  'kunlun-rites': [
    '转过玉阶，',
    '铜色的编钟正好奏完一组清音。',
    '礼官示意你落座，今天要讲的是雅乐如何拴住人心。'
  ],
  'kunlun-dialogue': [
    '夜色里，',
    '霓虹与雪山在同一扇玻璃上互相叠印。',
    '她看着你，问：这些旧辞还能装进今天的生活吗？'
  ]
}

const sampleChoices: Record<string, [string, string]> = {
  'kunlun-prologue': ['我愿意聆听昆仑的第一句话。', '这听起来过于神话，我需要证据。'],
  'kunlun-rites': ['雅乐确实让我心绪平稳。', '这些声响离今天太远了。'],
  'kunlun-dialogue': ['这份交叠正是文化延续的样子。', '霓虹归霓虹，旧辞应当留在旧辞里。']
}

const timers = reactive<{ timeouts: ReturnType<typeof setTimeout>[]; intervals: ReturnType<typeof setInterval>[] }>({
  timeouts: [],
  intervals: []
})
const clearTimers = (): void => {
  timers.timeouts.forEach((h) => clearTimeout(h))
  timers.intervals.forEach((h) => clearInterval(h))
  timers.timeouts.length = 0
  timers.intervals.length = 0
}

const scheduleReveal = (): void => {
  const handle = setInterval(() => {
    turn.revealNext(2)
    if (!turn.view.value.isRevealing && turn.view.value.snapshot.state === 'streaming') {
      clearInterval(handle)
    }
  }, 60)
  timers.intervals.push(handle)
}

const runTurn = (): void => {
  if (!currentNode.value) {
    return
  }
  clearTimers()
  turn.dispatch({ type: 'request-start' })
  const chunks = sampleNarratives[currentNode.value.id] ?? ['…']
  let delay = 320
  chunks.forEach((chunk) => {
    const handle = setTimeout(() => {
      turn.appendText(chunk)
    }, delay)
    timers.timeouts.push(handle)
    delay += 480
  })
  const endHandle = setTimeout(() => {
    turn.endStream()
    scheduleReveal()
  }, delay)
  timers.timeouts.push(endHandle)
  const choicesHandle = setTimeout(() => {
    turn.skipReveal()
    const pair = sampleChoices[currentNode.value!.id] ?? ['同意', '反驳']
    const choices: ChoiceModel[] = [
      { id: 'align', label: pair[0] },
      { id: 'challenge', label: pair[1] }
    ]
    turn.setChoices(choices)
  }, delay + 360)
  timers.timeouts.push(choicesHandle)
}

const beginMainline = (): void => {
  nodeIndex.value = 0
  turnIndex.value = 0
  attitudeScore.value = 0
  turn.reset()
  runTurn()
}

const onChoose = (choice: ChoiceModel): void => {
  const delta = choice.id === 'align' ? 1 : -1
  attitudeScore.value = Math.min(ATTITUDE_MAX, Math.max(ATTITUDE_MIN, attitudeScore.value + delta))
  turnIndex.value += 1
  turn.dispatch({ type: 'choice-made' })
  if (nodeIndex.value < demoNodes.length - 1) {
    nodeIndex.value += 1
  }
  runTurn()
}

const onRetry = (): void => {
  turn.dispatch({ type: 'retry' })
  runTurn()
}

const onSkip = (): void => {
  turn.skipReveal()
}

const onOpenSettings = (): void => {
  settingsOpen.value = true
}
const onCloseSettings = (): void => {
  settingsOpen.value = false
}
const onToggleBgm = (): void => {
  refreshBgm(bgm.toggle())
}
const onSetVolume = (value: number): void => {
  refreshBgm(bgm.setVolume(value))
}
const onBgmSource = (available: boolean): void => {
  refreshBgm(bgm.markSourceAvailable(available))
}

interface KunlunDebug {
  start(): void
  injectError(message: string): void
  snapshot(): {
    state: string
    visibleText: string
    nodeId: string | null
    attitude: number
  }
}
const exposeDebug = (): void => {
  const debug: KunlunDebug = {
    start: beginMainline,
    injectError(message: string) {
      clearTimers()
      turn.dispatch({ type: 'error', message })
    },
    snapshot() {
      return {
        state: turn.view.value.snapshot.state,
        visibleText: turn.view.value.visibleText,
        nodeId: currentNode.value?.id ?? null,
        attitude: attitudeScore.value
      }
    }
  }
  ;(window as unknown as { __kunlunDebug?: KunlunDebug }).__kunlunDebug = debug
}

onMounted(() => {
  exposeDebug()
})
onBeforeUnmount(() => {
  clearTimers()
})

const demoCharacter = computed(() => ({
  id: 'narrator',
  label: '叙述者',
  assetPath: null
}))

const showStartButton = computed(
  () =>
    turn.view.value.snapshot.state === 'idle' && turn.view.value.fullText.length === 0
)
</script>

<template>
  <GameShell
    :node="currentNode"
    :turn-index="turnIndex"
    :attitude-score="attitudeScore"
    :attitude-min="ATTITUDE_MIN"
    :attitude-max="ATTITUDE_MAX"
    :view="turn.view.value"
    :character="demoCharacter"
    :background-asset-path="null"
    :bgm="bgmState"
    :bgm-src="bgmSrc"
    :settings-open="settingsOpen"
    speaker-label="叙述者"
    @retry="onRetry"
    @skip="onSkip"
    @choose="onChoose"
    @open-settings="onOpenSettings"
    @close-settings="onCloseSettings"
    @toggle-bgm="onToggleBgm"
    @set-volume="onSetVolume"
    @bgm-source-resolved="onBgmSource"
  />
  <button
    v-if="showStartButton"
    type="button"
    class="start-button"
    data-testid="start-button"
    @click="beginMainline"
  >
    进入昆仑
  </button>
</template>

<style scoped>
.start-button {
  position: fixed;
  left: 50%;
  top: 38%;
  transform: translateX(-50%);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-accent);
  background: rgba(217, 119, 6, 0.12);
  color: var(--color-accent);
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
  cursor: pointer;
  z-index: var(--z-toast);
  transition: background var(--motion-fast) var(--ease-standard);
  min-height: 44px;
}

.start-button:hover,
.start-button:focus-visible {
  background: rgba(217, 119, 6, 0.24);
}
</style>
