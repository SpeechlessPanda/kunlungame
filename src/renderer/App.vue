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
import { serializeRuntimeStateForDesktop } from "../runtime/runtimeStateFacade.js";
import { mainlineStoryOutline } from "../content/source/mainlineOutline.js";
import type { StoryNode } from "../shared/contracts/contentContracts.js";
import type { OpenAiCompatibleSettings } from "./components/SettingsPanel.types.js";
import type { DesktopBridge } from "../shared/types/desktop.js";
import {
  createBgmController,
  type BgmControllerState,
} from "../presentation/bgmController.js";
import { wrapDesktopBridgeWithValidation } from "./lib/desktopBridgeClient.js";
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
import { buildRecentTurnMemory } from "./composables/recentTurnMemory.js";
import {
  createBridgeDialogueDependenciesFactory,
  createDefaultDialogueDependenciesFactory,
  buildMockDialogueDependencies,
} from "./adapters/rendererDialogueDependencies.js";
import { defaultAssetManifest } from "./assets/manifest.js";
import { resolveAssetPath } from "../shared/contracts/assetManifest.js";
import bgmMainThemeUrl from "./assets/audio/bgm-main-theme.mp3?url";

const storyOutline = mainlineStoryOutline;
const nodesById = new Map<string, StoryNode>(
  storyOutline.nodes.map((n) => [n.id, n]),
);
const findNode = (id: string): StoryNode | null => nodesById.get(id) ?? null;

const runtimeState = ref<RuntimeState>(createDefaultRuntimeState(storyOutline));
const currentNode = computed<StoryNode | null>(() =>
  findNode(runtimeState.value.currentNodeId),
);
const turnIndex = computed(() => runtimeState.value.turnIndex);
const attitudeScore = computed(() => runtimeState.value.attitudeScore);

const turn = createTurnController();

const bgm = createBgmController({ enabled: true });
const bgmState = ref<BgmControllerState>(bgm.snapshot());
const bgmSrc = ref<string | null>(bgmMainThemeUrl);

const refreshBgm = (next: BgmControllerState): void => {
  bgmState.value = next;
};

const settingsOpen = ref(false);

const recentTurns = ref<string[]>([]);
const attitudeChoiceMode = ref<PlayerAttitudeChoice>("align");

const dialogueSession = createDialogueSession({
  dependenciesFactory: createDefaultDialogueDependenciesFactory(),
});

const getBridge = (): DesktopBridge | null => {
  const raw = window.kunlunDesktop;
  return raw ? wrapDesktopBridgeWithValidation(raw) : null;
};

const runConnectionTest = async (
  request: import("../shared/types/desktop.js").DesktopOpenAiCompatibleTestRequest,
): Promise<
  import("../shared/types/desktop.js").DesktopOpenAiCompatibleTestResult
> => {
  const bridge = getBridge();
  if (bridge == null) {
    return {
      ok: false,
      reason: "network",
      message:
        "未检测到 Electron 桌面端能力；请在打包后的桌面应用中使用此功能。",
    };
  }
  return await bridge.testOpenAiCompatibleConnection(request);
};

const persistState = async (): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    await bridge.saveRuntimeState(
      serializeRuntimeStateForDesktop(runtimeState.value),
    );
  } catch (error) {
    console.error("[app] saveRuntimeState failed", error);
  }
};

const restoreFromBridge = async (): Promise<void> => {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    const snapshot = await bridge.loadRuntimeState();
    runtimeState.value = runtimeStateSchema.parse(snapshot.state);
    refreshBgm(
      runtimeState.value.settings.bgmEnabled ? bgm.enable() : bgm.disable(),
    );
    if (snapshot.recoveryAction === "reset-corrupted") {
      saveRecoveryNotice.value =
        "上次存档文件无法读取，已重置为默认状态。";
    }
  } catch (error) {
    console.error("[app] loadRuntimeState failed", error);
  }
};

const saveRecoveryNotice = ref<string | null>(null);
const dismissSaveRecoveryNotice = (): void => {
  saveRecoveryNotice.value = null;
};

const apiKeyMissingNotice = ref<string | null>(null);
const isApiProviderConfigured = computed<boolean>(() => {
  const cfg = runtimeState.value.settings.openAiCompatible;
  return cfg.apiKey.trim().length > 0 && cfg.model.trim().length > 0;
});
const promptForApiKeyIfMissing = (): boolean => {
  if (isApiProviderConfigured.value) {
    apiKeyMissingNotice.value = null;
    return true;
  }
  apiKeyMissingNotice.value =
    '请先在「设置」里填写 API Key 与模型名，再开始对话。';
  settingsOpen.value = true;
  return false;
};
const dismissApiKeyMissingNotice = (): void => {
  apiKeyMissingNotice.value = null;
};

const useMockStreamFlag = ref(true);
const aiSource = ref<"real" | "mock">("mock");
const aiSourceLabel = computed(() => {
  if (aiSource.value === "mock") return "预览脚本模式";
  const cfg = runtimeState.value.settings.openAiCompatible;
  return `API · ${cfg.model}`;
});

const runTurn = async (): Promise<void> => {
  await ensureDialogueSourceReady();
  const node = currentNode.value;
  if (!node) return;
  if (aiSource.value === "real" && !promptForApiKeyIfMissing()) return;
  await dialogueSession.runTurn(
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

const beginMainline = async (): Promise<void> => {
  await ensureDialogueSourceReady();
  const currentSettings = runtimeState.value.settings;
  runtimeState.value = createDefaultRuntimeState(storyOutline, currentSettings);
  recentTurns.value = [];
  attitudeChoiceMode.value = "align";
  dialogueSession.cancel();
  turn.reset();
  void persistState();
  await runTurn();
};

const onStartMainline = (): void => {
  void beginMainline();
};

const onChoose = (choice: ChoiceModel): void => {
  attitudeChoiceMode.value = choice.id;
  if (runtimeState.value.isCompleted) return;
  recentTurns.value = [
    ...recentTurns.value,
    buildRecentTurnMemory({
      modelReply: turn.view.value.fullText,
      choice,
    }),
  ].slice(-5);
  runtimeState.value = applyPlayerChoice({
    state: runtimeState.value,
    storyOutline,
    choice: choice.id,
  });
  turn.dispatch({ type: "choice-made" });
  void persistState();
  if (currentNode.value) {
    void runTurn();
  }
};

const onRetry = (): void => {
  turn.dispatch({ type: "retry" });
  void runTurn();
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
const onUpdateOpenAiCompatible = (settings: OpenAiCompatibleSettings): void => {
  runtimeState.value = {
    ...runtimeState.value,
    settings: {
      ...runtimeState.value.settings,
      openAiCompatible: settings,
    },
  };
  if (
    apiKeyMissingNotice.value != null &&
    settings.apiKey.trim().length > 0 &&
    settings.model.trim().length > 0
  ) {
    apiKeyMissingNotice.value = null;
  }
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

const applyDependenciesFactory = (): void => {
  if (useMockStreamFlag.value) {
    dialogueSession.setDependenciesFactory(
      createDefaultDialogueDependenciesFactory(),
    );
    return;
  }
  const bridge = getBridge();
  if (bridge == null || typeof bridge.runMainlineTurn !== "function") {
    const unavailableFactory: DialogueDependenciesFactory = () => ({
      streamText: async function* () {
        throw new Error("桌面 bridge 尚未注入。");
      },
      generateOptions: async () => {
        throw new Error("桌面 bridge 尚未注入。");
      },
    });
    dialogueSession.setDependenciesFactory(unavailableFactory);
    return;
  }
  const bridgeFactory = createBridgeDialogueDependenciesFactory(bridge);
  dialogueSession.setDependenciesFactory((context) => {
    if (context.runtimeState.isCompleted) {
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

const detectBridgeAvailable = (): boolean => {
  const bridge = window.kunlunDesktop;
  return bridge != null && typeof bridge.runMainlineTurn === "function";
};

const waitForDesktopBridge = async (
  attempts: number = 8,
  intervalMs: number = 80,
): Promise<boolean> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (detectBridgeAvailable()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  return detectBridgeAvailable();
};

const initializeDesktopBridge = async (): Promise<void> => {
  const available = await waitForDesktopBridge();
  useMockStreamFlag.value = !available;
  aiSource.value = available ? "real" : "mock";
  applyDependenciesFactory();
  if (!available) return;
  await restoreFromBridge();
};

let dialogueSourceReadyPromise: Promise<void> | null = null;

const ensureDialogueSourceReady = async (): Promise<void> => {
  if (dialogueSourceReadyPromise == null) {
    dialogueSourceReadyPromise = initializeDesktopBridge();
  }
  await dialogueSourceReadyPromise;
};

const exposeDebug = (): void => {
  const debug: KunlunDebug = {
    start() {
      void beginMainline();
    },
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
  (window as Window & { __kunlunDebug?: KunlunDebug }).__kunlunDebug = debug;
};

onMounted(() => {
  exposeDebug();
  void ensureDialogueSourceReady();
});
onBeforeUnmount(() => {
  dialogueSession.cancel();
});

const demoCharacter = computed(() => ({
  id: "kunlun",
  label: "昆仑子",
  assetPath: resolveAssetPath(
    defaultAssetManifest,
    "character.kunlun.portrait",
  ),
}));

const backgroundAssetPath = computed<string | null>(() => {
  if (!currentNode.value) return null;
  return resolveAssetPath(
    defaultAssetManifest,
    `background.${currentNode.value.id}.scene`,
  );
});

const showStartButton = computed(
  () =>
    !settingsOpen.value &&
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
  void beginMainline();
};

const onQuitFromEnding = (): void => {
  const bridge = getBridge();
  if (bridge != null && typeof bridge.quitApp === "function") {
    void bridge.quitApp();
    return;
  }
  void beginMainline();
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
    :open-ai-compatible="runtimeState.settings.openAiCompatible"
    :run-connection-test="runConnectionTest"
    speaker-label="昆仑子"
    @retry="onRetry"
    @skip="onSkip"
    @choose="onChoose"
    @open-settings="onOpenSettings"
    @close-settings="onCloseSettings"
    @toggle-bgm="onToggleBgm"
    @set-volume="onSetVolume"
    @update-openai-compatible="onUpdateOpenAiCompatible"
    @bgm-source-resolved="onBgmSource"
  />
  <button
    v-if="showStartButton"
    type="button"
    class="start-button"
    data-testid="start-button"
    @click="onStartMainline"
  >
    进入昆仑
  </button>
  <div
    v-if="!settingsOpen"
    class="ai-source-chip"
    :class="`ai-source-chip--${aiSource}`"
    data-testid="ai-source-chip"
    :title="
      aiSource === 'real'
        ? '当前对话由 API 模型生成。'
        : '当前对话是预览脚本输出，未调用 AI。'
    "
  >
    {{ aiSourceLabel }}
  </div>
  <EndingOverlay
    :open="endingOpen"
    :attitude-score="attitudeScore"
    :visited-node-titles="visitedNodeTitles"
    :can-quit="aiSource === 'real'"
    @restart="onRestartFromEnding"
    @quit="onQuitFromEnding"
  />
  <div
    v-if="saveRecoveryNotice"
    class="save-recovery-notice"
    role="status"
    aria-live="polite"
    data-testid="save-recovery-notice"
  >
    <span>{{ saveRecoveryNotice }}</span>
    <button
      type="button"
      class="save-recovery-notice__dismiss"
      data-testid="save-recovery-notice-dismiss"
      @click="dismissSaveRecoveryNotice"
    >
      收下
    </button>
  </div>
  <div
    v-if="apiKeyMissingNotice"
    class="save-recovery-notice save-recovery-notice--warning"
    role="alert"
    aria-live="assertive"
    data-testid="api-key-missing-notice"
  >
    <span>{{ apiKeyMissingNotice }}</span>
    <button
      type="button"
      class="save-recovery-notice__dismiss"
      data-testid="api-key-missing-notice-dismiss"
      @click="dismissApiKeyMissingNotice"
    >
      去填写
    </button>
  </div>
</template>

<style scoped>
.start-button {
  position: fixed;
  left: 50%;
  top: 38%;
  transform: translateX(-50%);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid rgba(216, 168, 79, 0.72);
  background: linear-gradient(
    180deg,
    rgba(248, 239, 222, 0.96),
    rgba(216, 168, 79, 0.88)
  );
  color: #2c2118;
  font-family: var(--font-serif);
  font-size: var(--font-size-lg);
  cursor: pointer;
  z-index: var(--z-toast);
  box-shadow: var(--shadow-pop);
  transition:
    background var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
  min-height: 44px;
}

.start-button:hover,
.start-button:focus-visible {
  background: linear-gradient(180deg, #fff4d8, #e3b65d);
  transform: translateX(-50%) translateY(-1px);
}

.ai-source-chip {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: var(--z-toast);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  letter-spacing: 0;
  font-family: var(--font-sans, system-ui);
  pointer-events: none;
  user-select: none;
  backdrop-filter: blur(6px);
}

.ai-source-chip--real {
  background: rgba(19, 71, 59, 0.82);
  color: #e9fff5;
  border: 1px solid rgba(129, 183, 157, 0.58);
}

.ai-source-chip--mock {
  background: rgba(121, 81, 39, 0.82);
  color: #fff1cf;
  border: 1px solid rgba(216, 168, 79, 0.55);
}

.save-recovery-notice {
  position: fixed;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  gap: var(--space-3, 12px);
  align-items: center;
  max-width: min(640px, 92vw);
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  background: rgba(120, 53, 15, 0.92);
  color: #fef3c7;
  border: 1px solid rgba(253, 230, 138, 0.55);
  font-family: var(--font-sans, system-ui);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

.save-recovery-notice__dismiss {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid rgba(253, 230, 138, 0.55);
  color: inherit;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  min-height: 32px;
}

.save-recovery-notice__dismiss:hover,
.save-recovery-notice__dismiss:focus-visible {
  background: rgba(253, 230, 138, 0.12);
}

.save-recovery-notice--warning {
  background: rgba(146, 64, 14, 0.94);
  border-color: rgba(253, 230, 138, 0.62);
  bottom: 88px;
}
</style>
