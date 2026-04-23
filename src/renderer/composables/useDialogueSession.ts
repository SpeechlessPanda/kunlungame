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
    /** 流结束后启动的逐字刷新节奏；注入便于测试。 */
    scheduleReveal?: (controller: TurnController) => void
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

const defaultScheduleReveal = (controller: TurnController): void => {
    const handle = setInterval(() => {
        controller.revealNext(2)
        const view = controller.view.value
        if (!view.isRevealing && view.snapshot.state === 'streaming') {
            clearInterval(handle)
        }
    }, 60)
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

            const dependencies = dependenciesFactory({ node: input.node })

            let streamEnded = false

            try {
                for await (const event of orchestrateDialogue(dependencies, orchestratorInput)) {
                    if (!isStillCurrent()) {
                        return
                    }

                    switch (event.type) {
                        case 'chunk':
                            controller.appendText(event.text)
                            break
                        case 'options':
                            if (!streamEnded) {
                                controller.endStream()
                                streamEnded = true
                                scheduleReveal(controller)
                            }
                            controller.skipReveal()
                            lastOptions.value = [...event.options]
                            controller.setChoices(mapOptionsToChoiceModels(event.options))
                            break
                        case 'complete':
                            if (!streamEnded) {
                                controller.endStream()
                                streamEnded = true
                                scheduleReveal(controller)
                            }
                            break
                        case 'error':
                            controller.dispatch({ type: 'error', message: event.message })
                            return
                    }
                }
            } catch (error: unknown) {
                if (!isStillCurrent()) {
                    return
                }
                const message =
                    error instanceof Error ? error.message : '对话流出现未知错误。'
                controller.dispatch({ type: 'error', message })
            }
        }
    }

    return session
}
