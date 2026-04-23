<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  ATTITUDE_MAX,
  ATTITUDE_MIN,
  applyPlayerChoice,
  createDefaultRuntimeState,
  type PlayerAttitudeChoice,
  type RuntimeState,
} from "../runtime/runtimeState.js";import { mainlineStoryOutline } from "../content/source/mainlineOutline.js";
import type { StoryNode } from "../shared/contracts/contentContracts.js";
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
import { defaultAssetManifest } from "./assets/manifest.js";
import { resolveAssetPath } from "../shared/contracts/assetManifest.js";

// --- Canonical 8 节点主线（Part 02 · mainlineStoryOutline） --------------
const storyOutline = mainlineStoryOutline;
const nodesById = new Map<string, StoryNode>(
  storyOutline.nodes.map((n) => [n.id, n]),
);
const findNode = (id: string): StoryNode | null => nodesById.get(id) ?? null;

// --- 运行时状态（态度值 / 已读节点 / 摘要由 outline 驱动重建） ----------
const runtimeState = ref<RuntimeState>(createDefaultRuntimeState(storyOutline));
const currentNode = computed<StoryNode | null>(() =>
  findNode(runtimeState.value.currentNodeId),
);
const turnIndex = computed(() => runtimeState.value.turnIndex);
const attitudeScore = computed(() => runtimeState.value.attitudeScore);

const turn = createTurnController();

const bgm = createBgmController({ enabled: true });
const bgmState = ref<BgmControllerState>(bgm.snapshot());
const bgmSrc = ref<string | null>(null);

const refreshBgm = (next: BgmControllerState): void => {
  bgmState.value = next;
};

const settingsOpen = ref(false);

const recentTurns = ref<string[]>([]);

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
      runtimeState: runtimeState.value,
      retrievedEntries: [],
      attitudeChoiceMode: attitudeChoiceMode.value,
      recentTurns: recentTurns.value.slice(-3),
    },
    turn,
  );
};

const beginMainline = (): void => {
  runtimeState.value = createDefaultRuntimeState(storyOutline);
  recentTurns.value = [];
  attitudeChoiceMode.value = "align";
  dialogueSession.cancel();
  turn.reset();
  runTurn();
};

const onChoose = (choice: ChoiceModel): void => {
  attitudeChoiceMode.value = choice.id;
  recentTurns.value = [...recentTurns.value, turn.view.value.fullText].slice(
    -5,
  );
  // Part 04 · applyPlayerChoice 负责态度值钳制、已读节点、摘要重建、主线推进。
  runtimeState.value = applyPlayerChoice({
    state: runtimeState.value,
    storyOutline,
    choice: choice.id,
  });
  turn.dispatch({ type: "choice-made" });
  if (currentNode.value) {
    runTurn();
  }
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
  assetPath: resolveAssetPath(
    defaultAssetManifest,
    "character.narrator.portrait",
  ),
}));

const backgroundAssetPath = computed<string | null>(() => {
  if (!currentNode.value) {
    return null;
  }
  return resolveAssetPath(
    defaultAssetManifest,
    `background.${currentNode.value.id}.scene`,
  );
});

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
    :background-asset-path="backgroundAssetPath"
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
