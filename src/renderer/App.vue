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
import {
  getProModelProfile,
  getAllKnownModelProfiles,
} from "../modeling/modelProfiles.js";
import type { StoryNode } from "../shared/contracts/contentContracts.js";
import type {
  DesktopBridge,
  DesktopProfileDownloadProgressEvent,
} from "../shared/types/desktop.js";
import {
  createBgmController,
  type BgmControllerState,
} from "../presentation/bgmController.js";
import GameShell from "./components/GameShell.vue";
import EndingOverlay from "./components/EndingOverlay.vue";
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

// 轻量模型标识：当选中非 Pro（7B）档位时，叙事密度已按小模型模板压缩。
const selectedProfileId = ref<string | null>(null);
const isFallbackModel = computed(
  () =>
    selectedProfileId.value !== null &&
    selectedProfileId.value !== getProModelProfile().id,
);

const profileAvailability = ref<
  Record<string, "ready" | "partial" | "missing" | "unknown">
>({});
const downloadStatus = ref<
  import("./components/SettingsPanel.vue").ProfileDownloadStatus | null
>(null);

const refreshProfileAvailability = async (
  profileId?: string,
): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  const idsToCheck = profileId
    ? [profileId]
    : getAllKnownModelProfiles().map((profile) => profile.id);
  for (const id of idsToCheck) {
    try {
      const availability = await bridge.getProfileAvailability(id);
      profileAvailability.value = {
        ...profileAvailability.value,
        [id]: availability.status,
      };
    } catch (error) {
      console.warn("[app] getProfileAvailability failed", id, error);
    }
  }
};

const onDownloadProfile = async (profileId: string): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  if (downloadStatus.value != null) return;
  downloadStatus.value = {
    profileId,
    phase: "starting",
    fileIndex: 0,
    totalFiles: 0,
    message: "开始下载…",
  };
  try {
    const result = await bridge.downloadProfile(profileId);
    if (!result.ok) {
      downloadStatus.value = {
        profileId,
        phase: "failed",
        fileIndex: 0,
        totalFiles: 0,
        message: result.message,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    downloadStatus.value = {
      profileId,
      phase: "failed",
      fileIndex: 0,
      totalFiles: 0,
      message,
    };
  }
  await refreshProfileAvailability(profileId);
  if (
    downloadStatus.value != null &&
    (downloadStatus.value.phase === "completed" ||
      downloadStatus.value.phase === "failed")
  ) {
    // 保留最终状态给 UI，2 秒后清空。
    const finalStatus = downloadStatus.value;
    setTimeout(() => {
      if (downloadStatus.value === finalStatus) {
        downloadStatus.value = null;
      }
    }, 2000);
  }
};

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
      turnsInCurrentNode: runtimeState.value.turnsInCurrentNode,
      attitudeScore: runtimeState.value.attitudeScore,
      historySummary: runtimeState.value.historySummary,
      readNodeIds: [...runtimeState.value.readNodeIds],
      isCompleted: runtimeState.value.isCompleted,
      settings: {
        bgmEnabled: runtimeState.value.settings.bgmEnabled,
        preferredModelMode: runtimeState.value.settings.preferredModelMode,
      },
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
  // 升华轮：主线已经完成后不再让选项推动任何状态 ——
  // 玩家看到的是 EndingOverlay，底层选择被忽略，避免"在最后一轮死循环"。
  if (runtimeState.value.isCompleted) {
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
    settings: {
      ...runtimeState.value.settings,
      bgmEnabled: bgmState.value.enabled,
    },
  };
  void persistState();
};
const onSetModelMode = (mode: "default" | "compatibility" | "pro"): void => {
  if (runtimeState.value.settings.preferredModelMode === mode) {
    return;
  }
  runtimeState.value = {
    ...runtimeState.value,
    settings: {
      ...runtimeState.value.settings,
      preferredModelMode: mode,
    },
  };
  void persistState();
  // 新模式在下一轮 `runMainlineTurn` 时生效；主进程会根据
  // runtimeState.settings.preferredModelMode 重新 bootstrapPlan。
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
// 推荐给 UI 指示器读的 "当前一轮对话源头"：【real · 桌面本地模型】或【mock · 预览脚本】。
// 玩家凭这个 chip 就能在 pnpm dev 里一眼判断输出是否真的走了本地 AI。
const aiSource = ref<"real" | "mock">("mock");
let unsubscribeDownloadProgress: (() => void) | null = null;
// 环境探测：在真实 Electron 桌面壳里自动切到真模型；浏览器预览仍走 mock。
const detectBridgeAvailable = (): boolean => {
  const bridge = (window as unknown as { kunlunDesktop?: DesktopBridge })
    .kunlunDesktop;
  return bridge != null && typeof bridge.runMainlineTurn === "function";
};

// 预加载 preload 与渲染进程存在微小竞态：某些环境下 kunlunDesktop 会在
// onMounted 之后几十毫秒才被注入。这里连续重试几次，避免被永久锁在 mock。
const waitForDesktopBridge = async (
  attempts: number = 8,
  intervalMs: number = 80,
): Promise<boolean> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (detectBridgeAvailable()) {
      return true;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  return detectBridgeAvailable();
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
      aiSource.value = enabled ? "mock" : "real";
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
  // 使用 waitForDesktopBridge 避免 preload 微延迟导致被锁在 mock。
  void waitForDesktopBridge().then((available) => {
    useMockStreamFlag.value = !available;
    aiSource.value = available ? "real" : "mock";
    applyDependenciesFactory();
  });
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
    void refreshProfileAvailability();
    unsubscribeDownloadProgress = bridge.onProfileDownloadProgress(
      (event: DesktopProfileDownloadProgressEvent) => {
        downloadStatus.value = {
          profileId: event.profileId,
          phase: event.phase,
          fileIndex: event.fileIndex,
          totalFiles: event.totalFiles,
          message: event.message,
        };
      },
    );
  }
});
onBeforeUnmount(() => {
  dialogueSession.cancel();
  if (unsubscribeDownloadProgress) {
    unsubscribeDownloadProgress();
    unsubscribeDownloadProgress = null;
  }
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

const endingOpen = computed(
  () =>
    runtimeState.value.isCompleted &&
    turn.view.value.snapshot.state === "awaiting-choice",
);

const visitedNodeTitles = computed<string[]>(() => {
  return runtimeState.value.readNodeIds
    .map((id) => findNode(id)?.title ?? null)
    .filter((title): title is string => title != null);
});

const onRestartFromEnding = (): void => {
  beginMainline();
};

const onQuitFromEnding = (): void => {
  const bridge = getBridge();
  if (bridge != null && typeof bridge.quitApp === "function") {
    void bridge.quitApp();
    return;
  }
  // 浏览器/预览环境下退出表现为重启主线。
  beginMainline();
};
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
    :preferred-model-mode="runtimeState.settings.preferredModelMode"
    :selected-profile-id="selectedProfileId"
    :profile-availability="profileAvailability"
    :download-status="downloadStatus"
    speaker-label="昆仑"
    @retry="onRetry"
    @skip="onSkip"
    @choose="onChoose"
    @open-settings="onOpenSettings"
    @close-settings="onCloseSettings"
    @toggle-bgm="onToggleBgm"
    @set-volume="onSetVolume"
    @bgm-source-resolved="onBgmSource"
    @set-model-mode="onSetModelMode"
    @download-profile="onDownloadProfile"
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
  <div
    class="ai-source-chip"
    :class="`ai-source-chip--${aiSource}`"
    data-testid="ai-source-chip"
    :title="
      aiSource === 'real'
        ? '当前一轮对话由桌面本地模型生成（本地 GGUF）。'
        : '当前一轮对话是预览脚本输出，未调用本地 AI。'
    "
  >
    {{ aiSource === "real" ? "本地 AI 连接中" : "预览脚本模式" }}
  </div>
  <EndingOverlay
    :open="endingOpen"
    :attitude-score="attitudeScore"
    :visited-node-titles="visitedNodeTitles"
    :can-quit="aiSource === 'real'"
    @restart="onRestartFromEnding"
    @quit="onQuitFromEnding"
  />
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

.ai-source-chip {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: var(--z-toast);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.04em;
  font-family: var(--font-sans, system-ui);
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(6px);
}

.ai-source-chip--real {
  background: rgba(22, 101, 52, 0.78);
  color: #ecfdf5;
  border: 1px solid rgba(187, 247, 208, 0.55);
}

.ai-source-chip--mock {
  background: rgba(120, 53, 15, 0.78);
  color: #fef3c7;
  border: 1px solid rgba(253, 230, 138, 0.55);
}
</style>
