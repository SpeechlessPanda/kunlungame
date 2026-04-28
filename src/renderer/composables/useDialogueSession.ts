import { ref, type Ref } from 'vue'
import {
    orchestrateDialogue,
    type DialogueDependencies,
    type DialogueOption,
    type DialogueOrchestratorInput
} from '../../modeling/dialogueOrchestrator.js'
import type {
    KnowledgeEntry,
    StoryNode
} from '../../shared/contracts/contentContracts.js'
import type {
    PlayerAttitudeChoice,
    RuntimeState
} from '../../runtime/runtimeState.js'
import type { ChoiceModel, TurnController } from './useTurnController.js'

/**
 * 将 `orchestrateDialogue` 的事件流接到 `useTurnController`。
 *
 * 职责：
 *   - 构造每轮需要的 `DialogueOrchestratorInput`；
 *   - 通过可注入的 deps 工厂消费事件；
 *   - 把 `chunk` / `options` / `complete` / `error` 路由到 turn controller；
 *   - 提供可取消的轮次句柄，便于 UI 切换节点或手动重置。
 *
 * 本层不触碰 state-machine 状态细节，只通过 controller 暴露的方法调用。
 */

export type DialogueDependenciesFactory = (context: {
    node: StoryNode
    runtimeState: RuntimeState
    retrievedEntries: KnowledgeEntry[]
    attitudeChoiceMode: PlayerAttitudeChoice
    recentTurns: string[]
}) => DialogueDependencies

export interface DialogueSessionTurnInput {
    node: StoryNode
    runtimeState: RuntimeState
    retrievedEntries: KnowledgeEntry[]
    attitudeChoiceMode: PlayerAttitudeChoice
    recentTurns: string[]
}

export interface DialogueSessionOptions {
    dependenciesFactory: DialogueDependenciesFactory
    /** 首个 chunk 到达后启动的逐字刷新节奏；注入便于测试。 */
    scheduleReveal?: (controller: TurnController) => void | (() => void)
}

export interface DialogueSession {
    /** 最近一轮返回的选项列表，主要用于调试 / 诊断。 */
    lastOptions: Readonly<Ref<DialogueOption[]>>
    /** 替换依赖工厂。用于 `useMockStream(false)` 之类的 runtime 切换。 */
    setDependenciesFactory(factory: DialogueDependenciesFactory): void
    /** 读取当前依赖工厂。 */
    getDependenciesFactory(): DialogueDependenciesFactory
    /** 触发一轮对话；返回 promise 用于等待完成或错误。 */
    runTurn(input: DialogueSessionTurnInput, controller: TurnController): Promise<void>
    /** 取消当前 pending 的轮次（下一次事件将被忽略）。 */
    cancel(): void
}

const mapOptionsToChoiceModels = (options: DialogueOption[]): ChoiceModel[] => {
    return options.map((option) => ({ id: option.semantic, label: option.label }))
}

const defaultScheduleReveal = (controller: TurnController): () => void => {
    // 自适应逐字呈现：基线 3 字/帧 @ 40ms => 75 字/秒，比之前 33 字/秒快一倍。
    // 当后端已经把 chunk 铺得很厚时（backlog 越大），按 backlog 比例提速到最多 12 字/帧，
    // 避免 API 流式回包后玩家还要再干等数秒才能看到全文。
    const baseIntervalMs = 40
    const handle = setInterval(() => {
        const view = controller.view.value
        const backlog = view.fullText.length - view.visibleText.length
        let charsPerStep = 3
        if (backlog > 200) charsPerStep = 12
        else if (backlog > 120) charsPerStep = 8
        else if (backlog > 60) charsPerStep = 5
        controller.revealNext(charsPerStep)
        const post = controller.view.value
        if (post.snapshot.state !== 'streaming' && post.snapshot.state !== 'loading') {
            clearInterval(handle)
        }
    }, baseIntervalMs)
    return () => clearInterval(handle)
}

export const createDialogueSession = (
    options: DialogueSessionOptions
): DialogueSession => {
    let dependenciesFactory = options.dependenciesFactory
    const scheduleReveal = options.scheduleReveal ?? defaultScheduleReveal
    const lastOptions = ref<DialogueOption[]>([])
    let runToken = 0

    const session: DialogueSession = {
        lastOptions: lastOptions as unknown as Readonly<Ref<DialogueOption[]>>,
        setDependenciesFactory(factory) {
            dependenciesFactory = factory
        },
        getDependenciesFactory() {
            return dependenciesFactory
        },
        cancel() {
            runToken += 1
        },
        async runTurn(input, controller) {
            runToken += 1
            const currentToken = runToken
            const isStillCurrent = (): boolean => currentToken === runToken

            controller.dispatch({ type: 'request-start' })

            const orchestratorInput: DialogueOrchestratorInput = {
                currentNode: input.node,
                retrievedEntries: input.retrievedEntries,
                runtimeState: input.runtimeState,
                attitudeChoiceMode: input.attitudeChoiceMode,
                recentTurns: input.recentTurns
            }

            const dependencies = dependenciesFactory({
                node: input.node,
                runtimeState: input.runtimeState,
                retrievedEntries: input.retrievedEntries,
                attitudeChoiceMode: input.attitudeChoiceMode,
                recentTurns: input.recentTurns
            })

            let streamEnded = false
            let stopReveal: (() => void) | null = null

            const ensureRevealScheduled = (): void => {
                if (stopReveal != null) return
                const maybeStop = scheduleReveal(controller)
                stopReveal = typeof maybeStop === 'function' ? maybeStop : () => { }
            }

            const stopRevealNow = (): void => {
                stopReveal?.()
                stopReveal = null
            }

            try {
                for await (const event of orchestrateDialogue(dependencies, orchestratorInput)) {
                    if (!isStillCurrent()) {
                        return
                    }

                    switch (event.type) {
                        case 'reset':
                            stopRevealNow()
                            controller.dispatch({ type: 'reset' })
                            controller.dispatch({ type: 'request-start' })
                            streamEnded = false
                            break
                        case 'chunk':
                            controller.appendText(event.text)
                            ensureRevealScheduled()
                            break
                        case 'options':
                            if (!streamEnded) {
                                controller.endStream()
                                streamEnded = true
                            }
                            controller.skipReveal()
                            lastOptions.value = [...event.options]
                            controller.setChoices(mapOptionsToChoiceModels(event.options))
                            break
                        case 'complete':
                            if (!streamEnded) {
                                controller.endStream()
                                streamEnded = true
                            }
                            break
                        case 'error':
                            stopRevealNow()
                            controller.dispatch({ type: 'error', message: event.message })
                            return
                    }
                }
            } catch (error: unknown) {
                if (!isStillCurrent()) {
                    return
                }
                stopRevealNow()
                const message =
                    error instanceof Error ? error.message : '对话流出现未知错误。'
                controller.dispatch({ type: 'error', message })
            }
        }
    }

    return session
}
