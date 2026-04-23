<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  ATTITUDE_MAX,
  ATTITUDE_MIN,
  applyPlayerChoice,
  createDefaultRuntimeState,
  runtimeStateSchema,
  type PlayerAttitudeChoice,
  type RuntimeState,
} from "../runtime/runtimeState.js";
import { mainlineStoryOutline } from "../content/source/mainlineOutline.js";
import { getFallbackModelProfile } from "../modeling/modelProfiles.js";
import type { StoryNode } from "../shared/contracts/contentContracts.js";
import type { DesktopBridge } from "../shared/types/desktop.js";
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
  createBridgeDialogueDependenciesFactory,
  createDefaultDialogueDependenciesFactory,
  buildMockDialogueDependencies,
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

// 轻量模型 fallback 标识：由 getStartupSnapshot / runMainlineTurn 回填。
const selectedProfileId = ref<string | null>(null);
const isFallbackModel = computed(
  () => selectedProfileId.value === getFallbackModelProfile().id,
);

const recentTurns = ref<string[]>([]);

const attitudeChoiceMode = ref<PlayerAttitudeChoice>("align");

const dialogueSession = createDialogueSession({
  dependenciesFactory: createDefaultDialogueDependenciesFactory(),
});

const getBridge = (): DesktopBridge | null => {
  return (
    (window as unknown as { kunlunDesktop?: DesktopBridge }).kunlunDesktop ??
    null
  );
};

const persistState = async (): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) {
    return;
  }
  try {
    await bridge.saveRuntimeState({
      saveVersion: runtimeState.value.saveVersion,
      currentNodeId: runtimeState.value.currentNodeId,
      turnIndex: runtimeState.value.turnIndex,
      attitudeScore: runtimeState.value.attitudeScore,
      historySummary: runtimeState.value.historySummary,
      readNodeIds: [...runtimeState.value.readNodeIds],
      settings: { bgmEnabled: runtimeState.value.settings.bgmEnabled },
    });
  } catch (error) {
    console.error("[app] saveRuntimeState failed", error);
  }
};

const restoreFromBridge = async (): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) {
    return;
  }
  try {
    const snapshot = await bridge.loadRuntimeState();
    runtimeState.value = runtimeStateSchema.parse(snapshot.state);
    refreshBgm(
      runtimeState.value.settings.bgmEnabled ? bgm.enable() : bgm.disable(),
    );
  } catch (error) {
    console.error("[app] loadRuntimeState failed", error);
  }
};

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
  void persistState();
  runTurn();
};

const onChoose = (choice: ChoiceModel): void => {
  attitudeChoiceMode.value = choice.id;
  // 升华轮：两个选项都作为"再走一次旅程"的入口，不再继续推进节点。
  if (runtimeState.value.isCompleted) {
    beginMainline();
    return;
  }
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
  void persistState();
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
  runtimeState.value = {
    ...runtimeState.value,
    settings: { bgmEnabled: bgmState.value.enabled },
  };
  void persistState();
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

// 环境探测：在真实 Electron 桌面壳里自动切到真模型；浏览器预览仍走 mock。
const detectBridgeAvailable = (): boolean => {
  const bridge = (window as unknown as { kunlunDesktop?: DesktopBridge })
    .kunlunDesktop;
  return bridge != null && typeof bridge.runMainlineTurn === "function";
};

const applyDependenciesFactory = (): void => {
  if (useMockStreamFlag.value) {
    // 复用默认工厂：它会把 turnIndex / attitude / isCompleted 透传给 mock，
    // 让每一次开场都因为玩家的历史选择而略有不同，而不是"开始游戏输出都一样"。
    dialogueSession.setDependenciesFactory(
      createDefaultDialogueDependenciesFactory(),
    );
    return;
  }
  // 真实本地模型：通过桌面 bridge IPC 把每一轮对话派发到主进程，
  // 让 node-llama-cpp 加载 GGUF 并跑完一轮后回传 chunks + options。
  const bridge = (window as unknown as { kunlunDesktop?: DesktopBridge })
    .kunlunDesktop;
  if (bridge == null || typeof bridge.runMainlineTurn !== "function") {
    const unavailableFactory: DialogueDependenciesFactory = () => ({
      streamText: async function* () {
        throw new Error(
          "桌面 bridge 尚未注入或 runMainlineTurn 不可用（可能在非 Electron 环境运行）。",
        );
      },
      generateOptions: async () => {
        throw new Error(
          "桌面 bridge 尚未注入或 runMainlineTurn 不可用（可能在非 Electron 环境运行）。",
        );
      },
    });
    dialogueSession.setDependenciesFactory(unavailableFactory);
    return;
  }
  const bridgeFactory = createBridgeDialogueDependenciesFactory(bridge);
  dialogueSession.setDependenciesFactory((context) => {
    if (context.runtimeState.isCompleted) {
      // 升华轮不需要真正唤起本地模型，直接用本地 mock 的结尾分支即可。
      return buildMockDialogueDependencies(context.node, {
        attitudeChoiceMode: context.attitudeChoiceMode,
        turnIndex: context.runtimeState.turnIndex,
        attitudeScore: context.runtimeState.attitudeScore,
        isEnding: true,
      });
    }
    return bridgeFactory(context);
  });
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
  // 桌面壳里默认接入真实本地模型；浏览器/开发预览下仍走 mock 流。
  useMockStreamFlag.value = !detectBridgeAvailable();
  applyDependenciesFactory();
  exposeDebug();
  void restoreFromBridge();
  const bridge = getBridge();
  if (bridge) {
    void bridge
      .getStartupSnapshot()
      .then((snapshot) => {
        selectedProfileId.value = snapshot.modelSetup.selectedProfileId;
      })
      .catch((error) => {
        console.warn("[app] getStartupSnapshot failed", error);
      });
  }
});
onBeforeUnmount(() => {
  dialogueSession.cancel();
});

const demoCharacter = computed(() => ({
  id: "kunlun",
  label: "昆仑",
  assetPath: resolveAssetPath(
    defaultAssetManifest,
    "character.kunlun.portrait",
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
    :is-fallback-model="isFallbackModel"
    speaker-label="昆仑"
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
