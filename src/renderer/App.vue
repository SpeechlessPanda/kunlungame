<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  ATTITUDE_MAX,
  ATTITUDE_MIN,
  SAVE_VERSION,
  type PlayerAttitudeChoice,
  type RuntimeState,
} from "../runtime/runtimeState.js";
import {
  minimalStoryOutline,
  type StoryNode,
} from "../shared/contracts/contentContracts.js";
import {
  createBgmController,
  type BgmControllerState,
} from "../presentation/bgmController.js";
import GameShell from "./components/GameShell.vue";
import {
  createTurnController,
  type ChoiceModel,
} from "./composables/useTurnController.js";
import {
  createDialogueSession,
  type DialogueDependenciesFactory,
} from "./composables/useDialogueSession.js";
import {
  buildMockDialogueDependencies,
  createDefaultDialogueDependenciesFactory,
} from "./adapters/rendererDialogueDependencies.js";

// --- 演示用节点（未接入真实主线前的回退内容） -------------------------------
const demoNodes: StoryNode[] = [
  minimalStoryOutline.nodes[0]!,
  {
    id: "kunlun-rites",
    title: "礼乐之径",
    era: "ritual-music",
    theme: "礼乐文明",
    coreQuestion: "礼乐如何把神话秩序落地成生活秩序？",
    summary: "从神话边界过渡到礼乐文明的历史现场。",
    mustIncludeFacts: ["周代礼乐制度以钟鼓为核心"],
    retrievalKeywords: ["礼乐", "周礼", "编钟"],
    recommendedFigures: ["周公"],
    allowedKnowledgeTopics: ["ritual-music"],
    forbiddenFutureTopics: [],
    backgroundMode: "photographic",
    backgroundHint: "青铜编钟与朱漆礼器陈列在博物馆灯光下。",
    toneHint: "沉稳、克制、略带敬畏。",
    characterCueIds: [],
    minTurns: 1,
    nextNodeId: null,
  },
  {
    id: "kunlun-dialogue",
    title: "今古对谈",
    era: "modern-dialogue",
    theme: "现代转化",
    coreQuestion: "古典文化如何在今天的日常里继续生效？",
    summary: "神话与今天的日常生活在同一个画面里并置。",
    mustIncludeFacts: ["传统文化的现代转化是持续命题"],
    retrievalKeywords: ["现代", "传统", "转化"],
    recommendedFigures: ["叙述者"],
    allowedKnowledgeTopics: ["modern-transformation"],
    forbiddenFutureTopics: [],
    backgroundMode: "composite",
    backgroundHint: "夜色中的城市天际线与昆仑雪山叠印。",
    toneHint: "好奇、清醒、对话式。",
    characterCueIds: [],
    minTurns: 1,
    nextNodeId: null,
  },
];

const nodeIndex = ref(0);
const currentNode = computed<StoryNode | null>(
  () => demoNodes[nodeIndex.value] ?? null,
);

const turnIndex = ref(0);
const attitudeScore = ref(0);

const turn = createTurnController();

const bgm = createBgmController({ enabled: true });
const bgmState = ref<BgmControllerState>(bgm.snapshot());
const bgmSrc = ref<string | null>(null);

const refreshBgm = (next: BgmControllerState): void => {
  bgmState.value = next;
};

const settingsOpen = ref(false);

const recentTurns = ref<string[]>([]);

const buildRuntimeState = (): RuntimeState => ({
  saveVersion: SAVE_VERSION,
  currentNodeId: currentNode.value?.id ?? demoNodes[0]!.id,
  turnIndex: turnIndex.value,
  attitudeScore: attitudeScore.value,
  historySummary:
    recentTurns.value.length === 0
      ? "尚未展开任何对话。"
      : `已经历 ${recentTurns.value.length} 轮对话。`,
  readNodeIds: demoNodes
    .slice(0, Math.min(nodeIndex.value, demoNodes.length))
    .map((n) => n.id),
  settings: { bgmEnabled: bgmState.value.enabled },
});

const attitudeChoiceMode = ref<PlayerAttitudeChoice>("align");

const dialogueSession = createDialogueSession({
  dependenciesFactory: createDefaultDialogueDependenciesFactory(),
});

const runTurn = (): void => {
  const node = currentNode.value;
  if (!node) {
    return;
  }
  void dialogueSession.runTurn(
    {
      node,
      runtimeState: buildRuntimeState(),
      retrievedEntries: [],
      attitudeChoiceMode: attitudeChoiceMode.value,
      recentTurns: recentTurns.value.slice(-3),
    },
    turn,
  );
};

const beginMainline = (): void => {
  nodeIndex.value = 0;
  turnIndex.value = 0;
  attitudeScore.value = 0;
  recentTurns.value = [];
  attitudeChoiceMode.value = "align";
  dialogueSession.cancel();
  turn.reset();
  runTurn();
};

const onChoose = (choice: ChoiceModel): void => {
  const delta = choice.id === "align" ? 1 : -1;
  attitudeScore.value = Math.min(
    ATTITUDE_MAX,
    Math.max(ATTITUDE_MIN, attitudeScore.value + delta),
  );
  attitudeChoiceMode.value = choice.id;
  turnIndex.value += 1;
  recentTurns.value = [...recentTurns.value, turn.view.value.fullText].slice(
    -5,
  );
  turn.dispatch({ type: "choice-made" });
  if (nodeIndex.value < demoNodes.length - 1) {
    nodeIndex.value += 1;
  }
  runTurn();
};

const onRetry = (): void => {
  turn.dispatch({ type: "retry" });
  runTurn();
};

const onSkip = (): void => {
  turn.skipReveal();
};

const onOpenSettings = (): void => {
  settingsOpen.value = true;
};
const onCloseSettings = (): void => {
  settingsOpen.value = false;
};
const onToggleBgm = (): void => {
  refreshBgm(bgm.toggle());
};
const onSetVolume = (value: number): void => {
  refreshBgm(bgm.setVolume(value));
};
const onBgmSource = (available: boolean): void => {
  refreshBgm(bgm.markSourceAvailable(available));
};

interface KunlunDebug {
  start(): void;
  injectError(message: string): void;
  snapshot(): {
    state: string;
    visibleText: string;
    nodeId: string | null;
    attitude: number;
  };
  useMockStream(enabled: boolean): void;
  getLastOptions(): { semantic: PlayerAttitudeChoice; label: string }[];
}

const useMockStreamFlag = ref(true);

const applyDependenciesFactory = (): void => {
  if (useMockStreamFlag.value) {
    dialogueSession.setDependenciesFactory(({ node }) =>
      buildMockDialogueDependencies(node),
    );
    return;
  }
  // 真实本地模型依赖接入由后续 session 补充。当前 fallback：
  // 用一个立即报错的工厂，让 UI 能呈现 error 态，而不是静默成功。
  const unavailableFactory: DialogueDependenciesFactory = () => ({
    streamText: async function* () {
      throw new Error("真实本地模型依赖尚未在渲染进程接入。");
    },
    generateOptions: async () => {
      throw new Error("真实本地模型依赖尚未在渲染进程接入。");
    },
  });
  dialogueSession.setDependenciesFactory(unavailableFactory);
};

const exposeDebug = (): void => {
  const debug: KunlunDebug = {
    start: beginMainline,
    injectError(message: string) {
      dialogueSession.cancel();
      turn.dispatch({ type: "error", message });
    },
    snapshot() {
      return {
        state: turn.view.value.snapshot.state,
        visibleText: turn.view.value.visibleText,
        nodeId: currentNode.value?.id ?? null,
        attitude: attitudeScore.value,
      };
    },
    useMockStream(enabled: boolean) {
      useMockStreamFlag.value = enabled;
      applyDependenciesFactory();
    },
    getLastOptions() {
      return dialogueSession.lastOptions.value.map((option) => ({
        semantic: option.semantic,
        label: option.label,
      }));
    },
  };
  (window as unknown as { __kunlunDebug?: KunlunDebug }).__kunlunDebug = debug;
};

onMounted(() => {
  applyDependenciesFactory();
  exposeDebug();
});
onBeforeUnmount(() => {
  dialogueSession.cancel();
});

const demoCharacter = computed(() => ({
  id: "narrator",
  label: "叙述者",
  assetPath: null,
}));

const showStartButton = computed(
  () =>
    turn.view.value.snapshot.state === "idle" &&
    turn.view.value.fullText.length === 0,
);
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
