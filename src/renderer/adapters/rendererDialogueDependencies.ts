import type {
    DialogueDependencies,
    DialogueOption
} from '../../modeling/dialogueOrchestrator.js'
import type { StoryNode } from '../../shared/contracts/contentContracts.js'

/**
 * Renderer 侧 `DialogueDependencies` 适配层。
 *
 * 目前桌面壳在典型开发启动下不一定持有本地 llama 运行时，
 * 所以默认使用 deterministic mock，让 UI Demo 与 E2E 能独立跑通。
 * 真正的本地模型依赖接入将通过 `window.__kunlunDebug.useMockStream(false)`
 * 触发替换（首次接入在未来的 session 里补上）。
 */

const mockChunksByNode: Record<string, string[]> = {
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

const mockChoiceLabelsByNode: Record<string, [string, string]> = {
    'kunlun-prologue': ['我愿意聆听昆仑的第一句话。', '这听起来过于神话，我需要证据。'],
    'kunlun-rites': ['雅乐确实让我心绪平稳。', '这些声响离今天太远了。'],
    'kunlun-dialogue': ['这份交叠正是文化延续的样子。', '霓虹归霓虹，旧辞应当留在旧辞里。']
}

const fallbackChunks = (node: StoryNode): string[] => [
    `${node.title}。`,
    `${node.summary}`
]

const fallbackChoiceLabels = (): [string, string] => ['同意这条路径。', '质疑这条路径。']

export interface MockDialogueDependenciesOptions {
    /** 每个流 chunk 之间的延迟（毫秒）。默认 160ms，便于 UI 呈现逐字动效。 */
    chunkDelayMs?: number
    /** 选项发送前的额外延迟（毫秒）。默认 120ms。 */
    optionsDelayMs?: number
    /** 测试注入的 sleep 实现。默认使用 `setTimeout`。 */
    sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 构造一个与某个当前节点绑定的 mock `DialogueDependencies`。
 *
 * 每轮对话重新构造即可。内部仍然走真实的 `orchestrateDialogue` 管线，
 * 只是 `streamText` / `generateOptions` 的具体实现是 scripted。
 */
export const buildMockDialogueDependencies = (
    node: StoryNode,
    options: MockDialogueDependenciesOptions = {}
): DialogueDependencies => {
    const chunkDelayMs = options.chunkDelayMs ?? 160
    const optionsDelayMs = options.optionsDelayMs ?? 120
    const sleep = options.sleep ?? defaultSleep

    return {
        streamText: async function* streamText() {
            const chunks = mockChunksByNode[node.id] ?? fallbackChunks(node)
            // 规约：每个节点至少两段文本，避免 UI 呈现出“整段一次到位”。
            const normalized = chunks.length >= 2 ? chunks : [...chunks, '……']
            for (let index = 0; index < normalized.length; index += 1) {
                if (index > 0) {
                    await sleep(chunkDelayMs)
                }
                yield normalized[index]!
            }
        },
        generateOptions: async ({ semantics }): Promise<DialogueOption[]> => {
            if (optionsDelayMs > 0) {
                await sleep(optionsDelayMs)
            }
            const labels = mockChoiceLabelsByNode[node.id] ?? fallbackChoiceLabels()
            const alignLabel = labels[0]
            const challengeLabel = labels[1]
            return semantics.map((semantic) => ({
                semantic,
                label: semantic === 'align' ? alignLabel : challengeLabel
            }))
        }
    }
}

export interface DialogueDependenciesFactoryInput {
    node: StoryNode
}

export type DialogueDependenciesFactory = (
    input: DialogueDependenciesFactoryInput
) => DialogueDependencies

/**
 * 默认工厂：始终返回当前节点对应的 mock。未来接入真实本地模型时，
 * 可在运行时通过 `setDialogueDependenciesFactory` 替换。
 */
export const createDefaultDialogueDependenciesFactory = (
    options: MockDialogueDependenciesOptions = {}
): DialogueDependenciesFactory => {
    return ({ node }) => buildMockDialogueDependencies(node, options)
}
