import type {
    DialogueDependencies,
    DialogueOption
} from '../../modeling/dialogueOrchestrator.js'
import type { KnowledgeEntry, StoryNode } from '../../shared/contracts/contentContracts.js'
import type {
    DesktopBridge,
    DesktopMainlineTurnRequest,
    DesktopMainlineTurnResult,
    DesktopSerializedRuntimeState
} from '../../shared/types/desktop.js'
import type { PlayerAttitudeChoice, RuntimeState } from '../../runtime/runtimeState.js'

/**
 * Renderer 侧 `DialogueDependencies` 适配层。
 *
 * 目前桌面壳在典型开发启动下不一定持有本地 llama 运行时，
 * 所以默认使用 deterministic mock，让 UI Demo 与 E2E 能独立跑通。
 * 真正的本地模型依赖接入将通过 `window.__kunlunDebug.useMockStream(false)`
 * 触发替换（首次接入在未来的 session 里补上）。
 */

/**
 * 每一节内容都按「第二人称叙事 + 场景 + 史实锚点 + 开启式追问」的节奏写：
 *   1) 开场环境（两三段具体可感的意象，避免抽象宏大词）；
 *   2) 把节点的 mustIncludeFacts 用自然句子串起来，不做说教；
 *   3) 以一个面向"你"的追问作结，呼应选项。
 *
 * chunk 的切分故意保留从句级的短句，交给 streamText 呈现逐字揭示的节奏。
 */
const mockChunksByNode: Record<string, string[]> = {
    // —— Part 2 · canonical 8 节点 —— //
    'kunlun-threshold': [
        '风从西北来，',
        '带着盐湖、雪线与古老羊皮的气味。',
        '你站在昆仑山口，',
        '面前是被云海切成两半的天。',
        '传说里，这座山曾被称作世界的中心——',
        '不仅因为它真的高，',
        '更因为它承载着天人之轴的想象：人间要朝哪里抬头，就朝昆仑。',
        '西王母的传说在这里被不同时代反复改写，',
        '从远古的神格，到汉代的仙界主母，',
        '她的形象记录下的，是昆仑文化不断演化的痕迹。',
        '你还没说话，',
        '风却先替你问了第一句：',
        '我们为什么从昆仑开始，重新回望自己？'
    ],
    'creation-myths': [
        '天幕像一张尚未合拢的蛋壳，',
        '在你抬头的一瞬，被盘古的斧光裂开。',
        '他顶住天、踏住地，',
        '让这片世界先有了"上"和"下"的分别。',
        '风刚刚落定，',
        '女娲已经俯身在黄土上，',
        '捏出第一批泥人；',
        '天若有破洞，她便炼五色石去补。',
        '中国神话从不只是解释世界从哪里来，',
        '它同时告诉你：世界也需要被修补。',
        '再往下，',
        '大禹治水把神话的河改成了人力的河，',
        '从此神话与秩序之间，有了一座渡口。',
        '现在，',
        '这三位名字已经落在你身后——',
        '你更愿意把它们当作比喻，还是当作一次真实的开天？'
    ],
    'civilization-roots': [
        '祭火在远处的台基上亮起，',
        '像一颗不肯熄灭的星。',
        '燧人钻木，',
        '让"文明"这件事第一次变成可保存的技艺；',
        '伏羲画卦，',
        '把天地规律收束成可以传授的符号；',
        '神农尝百草，',
        '用身体换来后世的农医根基。',
        '再往后，',
        '黄帝会盟，尧舜禹继位，',
        '一条带着秩序感的文明线被慢慢拉直。',
        '"炎黄子孙"这四个字并不是血缘的精准测量，',
        '它是一次更大的发明——',
        '让多元的部族想象自己属于同一条来路。',
        '所以，',
        '当今天的你第一次脱口说"我们炎黄子孙"时，',
        '真正在背书的，是哪一种共同体？'
    ],
    'order-and-thought': [
        '青铜编钟被敲响的一瞬，',
        '整个厅堂安静下来。',
        '这是周公给中国人安装的第一套社会操作系统——',
        '礼与乐互相校准，',
        '让秩序不至于变成压迫，让自由不至于变成混乱。',
        '稍晚一些，',
        '《周易》把自然的变化、社会的分寸与人生的进退',
        '压缩进了六十四卦的骨架里。',
        '然后春秋战国来了，',
        '孔子走过诸侯的门前，',
        '老子骑牛出关，',
        '孟子与告子在辩台前寸步不让——',
        '诸子百家不是一张答案的清单，',
        '而是一场让中国人学会争论的训练。',
        '你走在这条声响还没完全散去的廊下，',
        '更被哪一支声音拽住？'
    ],
    'empire-and-openness': [
        '函谷关外，秦兵的战车碾过同一宽度的车辙；',
        '关内，',
        '小篆与度量衡正在把一个王国拼成一份共同书写。',
        '司马迁伏案写《史记》，',
        '把零散的先秦记忆，',
        '缝成了一条可被反复翻阅的长卷。',
        '到了汉唐，',
        '丝绸之路从敦煌一路延伸出去，',
        '带去的是瓷器、纸张与诗句，',
        '带回的是乐舞、宗教与异域的面孔。',
        '长安的夜市灯火通明，',
        '胡商、僧人、诗人挤在同一条街上，',
        '没人觉得这些并置是奇怪的。',
        '你眼前这幅既统一又开放的图景，',
        '让你更想赞叹它的气度，还是更想追问它付出的代价？'
    ],
    'fusion-and-refinement': [
        '宋代的书斋里，',
        '一盏清茶、一本《东坡志林》、窗外一帘冷雨——',
        '这就是一个文明学会把日子过细的样子。',
        '苏轼的词里，',
        '家国之痛与街市的一碗羊汤可以并存；',
        '理学把"格物致知"四个字塞进每一个书生的晨昏定省。',
        '元明两代，',
        '青花的蓝顺着海船摇晃到遥远的港口，',
        '郑和的船队带回香料，也带回新的世界观。',
        '到了清代，',
        '《红楼梦》把一场家族的兴衰写成了中国审美的集大成——',
        '典籍被一次次整理、注释、重编，',
        '文明在自我重写中继续生长。',
        '你站在这片精致与融合的厚度里，',
        '更愿意把它当作高峰，还是当作正在发生的一种日常？'
    ],
    'rupture-and-guardianship': [
        '炮声来了。',
        '海口被撬开、条约被按下、皇城易主——',
        '近代的中国，',
        '第一次被迫承认自己不能只按旧有的节拍走下去。',
        '五四的学生走上街头，',
        '鲁迅落笔如匕首；',
        '批判之外，',
        '也有人在废墟里捡拾——',
        '梁思成与林徽因趴在北方寒冷的古建筑上量尺寸，',
        '把一份随时可能失传的木构秩序，',
        '写进《中国建筑史》的第一批纸页。',
        '断裂的时候，',
        '总有人把文脉抄录、抢运、藏匿、重读。',
        '这段故事不适合被浪漫化，',
        '但它值得你诚实地看一眼——',
        '当代价如此高昂，为什么仍然有人愿意守？'
    ],
    'contemporary-return': [
        '故宫文创、数字展陈、短视频里的非遗传人——',
        '传统并没有安静地躺在博物馆里。',
        '费孝通先生晚年提出"文化自觉"四个字，',
        '他要的不是背诵，而是你知道自己从哪里来、要往哪里去。',
        '《国家宝藏》把一件瓷、一幅卷、一段铭文，',
        '讲成和今天这条通勤路同样具体的生活；',
        '非遗传承人把昆曲、皮影、刺绣带进直播间，',
        '让老手艺在点赞和弹幕里继续呼吸。',
        '从昆仑到今天，',
        '这条漫长的回路已经在你脚下闭合。',
        '你低头看看自己此刻握住的手机、写下的字、唱过的歌，',
        '轻轻问一句——',
        '为什么今天的我，仍然需要这些文化记忆？'
    ],

    // —— 旧 demo 节点保留，便于回归与 fallback —— //
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
    // —— canonical 8 节点：align 顺着叙事往下走；challenge 替"现代怀疑论的我"发声 —— //
    'kunlun-threshold': [
        '愿意让昆仑替我重新找回一个起点。',
        '先别急——"世界中心"只是古人的自我想象罢了。'
    ],
    'creation-myths': [
        '这些神话是一种更早的思考方式，值得认真听。',
        '盘古与女娲再动人，也替代不了真实的考古证据。'
    ],
    'civilization-roots': [
        '我愿意把"炎黄子孙"理解成一次共同体的发明。',
        '用一个传说去粘合那么多部族，这本身就很可疑。'
    ],
    'order-and-thought': [
        '礼乐与诸子合起来，才是中国人处理秩序的方式。',
        '把社会交给一套礼法体系，代价是不是被你们低估了？'
    ],
    'empire-and-openness': [
        '大一统与开放其实是同一件事的两面，我听进去了。',
        '盛唐气象背后，是用多少边地与百姓的苦撑起来的？'
    ],
    'fusion-and-refinement': [
        '把精致与融合理解成文明持续生长，我接受这个说法。',
        '所谓"高峰"有没有美化一个漫长的停滞期？'
    ],
    'rupture-and-guardianship': [
        '这些在断裂里守护文脉的人，是真正的当代英雄。',
        '被动挨打之后再讲"守护"，会不会太便宜了？'
    ],
    'contemporary-return': [
        '我能感觉到这份文化回响正在影响今天的我。',
        '文创与流量的包装下，"文化自觉"会不会被稀释？'
    ],

    // —— 旧 demo 节点 fallback —— //
    'kunlun-prologue': ['我愿意聆听昆仑的第一句话。', '这听起来过于神话，我需要证据。'],
    'kunlun-rites': ['雅乐确实让我心绪平稳。', '这些声响离今天太远了。'],
    'kunlun-dialogue': ['这份交叠正是文化延续的样子。', '霓虹归霓虹，旧辞应当留在旧辞里。']
}

const fallbackChunks = (node: StoryNode): string[] => [
    `${node.title}。`,
    `${node.summary}`,
    `核心追问：${node.coreQuestion}`
]

const fallbackChoiceLabels = (node: StoryNode): [string, string] => [
    `「${node.title}」……嗯——我想继续听你往下讲，好不好？`,
    `诶——「${node.title}」这里我有点想先追问一下。`
]

/**
 * 态度驱动的开场微变体。
 *
 * 玩家上一轮选了顺从 or 反驳，会让「小妹妹」这一段开场的第一口气明显不同。
 * 这些开场不携带任何史实，纯粹是语气层的变化，和节点内容解耦。
 */
const ALIGN_OPENERS = [
    '嘻嘻——你愿意继续听我讲，',
    '诶，那我就接着说啦——',
    '嗯嗯，那我们慢慢往下走——',
    '好耶，你没打断我，那我要开始认真说了——'
]
const CHALLENGE_OPENERS = [
    '哼——你刚才那样一问，我倒也认真想了一下，',
    '诶……你这样反驳我，我得把话说得更稳一些，',
    '唔，被你戳了一下，那我就把证据先摆出来——',
    '才不是你说的那样啦，不过——我先把话补完：'
]
/** 节点内部的收尾变体（由 turnIndex 做低熵选择，避免每轮开场都一样）。*/
const SOFT_TAIL_VARIANTS = [
    '——你觉得呢？',
    '……这一段，你愿意和我一起走吗？',
    '我说到这里，你想先停一停，还是继续？',
    '嗯——这个问题，你更想从哪一面看？'
]

const pickVariant = <T>(pool: readonly T[], seed: number): T => {
    if (pool.length === 0) {
        throw new Error('pickVariant requires a non-empty pool.')
    }
    const safeSeed = Math.max(0, Math.floor(seed))
    return pool[safeSeed % pool.length]!
}

const buildVariedChunks = (
    baseChunks: readonly string[],
    attitudeChoiceMode: PlayerAttitudeChoice,
    turnIndex: number,
    isFirstTurnOfSession: boolean
): string[] => {
    // 首轮（turnIndex=0）时玩家还没选过，使用一个中性开场，避免误导式甜腻。
    const opener = isFirstTurnOfSession
        ? '……第一次见面呢——那我先自我介绍一下，'
        : attitudeChoiceMode === 'align'
            ? pickVariant(ALIGN_OPENERS, turnIndex)
            : pickVariant(CHALLENGE_OPENERS, turnIndex)
    const tail = pickVariant(SOFT_TAIL_VARIANTS, turnIndex + (attitudeChoiceMode === 'align' ? 0 : 2))
    // 混一点动作描写，画面感更靠近 galgame
    const microGesture = isFirstTurnOfSession
        ? '（偏了偏头，眼睛亮了一下）'
        : attitudeChoiceMode === 'align'
            ? '（嘴角翘起来一点点）'
            : '（嘟了嘟嘴，又认真看向你）'
    return [opener, microGesture, ...baseChunks, tail]
}

/**
 * 结尾节点（`runtimeState.isCompleted === true`）专用的升华式结语。
 *
 * 不再请求任何选项，UI 会把选项区替换成"回到起点"按钮；这里只需提供
 * 一段温柔的收束，把玩家此次旅程里的态度倾向（顺从/反驳多一些）反射回来。
 */
const ENDING_POSITIVE = [
    '……走到这里，我们真的走完一圈啦。',
    '（把手背到身后，歪头看你）',
    '从昆仑的那阵风开始，到你手机里今天这条通勤路，',
    '文化其实一直没离开过——它就在你说的每一个字里、听的每一首歌里。',
    '谢谢你愿意一路顺着我听下来，',
    '嘻嘻，下次见面的时候，换你告诉我新故事好不好？'
]
const ENDING_NEUTRAL = [
    '……我们在这里停一下吧。',
    '（轻轻叹了口气，又笑了笑）',
    '你一路上既接住过我，也反驳过我——其实这才是最好的听故事的方式。',
    '文化不是我单向讲给你听，',
    '是我们一起把它重新想了一遍。',
    '旅程到这里告一段落，谢谢你陪我走了这么久。'
]
const ENDING_SKEPTICAL = [
    '……好啦，到这里该收了。',
    '（把手插进衣袖里，抬头看你）',
    '你一路上都在追问我——说真的，我不讨厌这样。',
    '文化从来不怕被质疑，反而怕被毫无表情地接受。',
    '你今天留下的那些"可是"，比我所有甜甜的话都更重要。',
    '谢谢你愿意较真，我们有缘再见。'
]

const buildEndingChunks = (attitudeScore: number): string[] => {
    if (attitudeScore >= 2) {
        return ENDING_POSITIVE
    }
    if (attitudeScore <= -2) {
        return ENDING_SKEPTICAL
    }
    return ENDING_NEUTRAL
}

export interface MockDialogueDependenciesOptions {
    /** 每个流 chunk 之间的延迟（毫秒）。默认 160ms，便于 UI 呈现逐字动效。 */
    chunkDelayMs?: number
    /** 选项发送前的额外延迟（毫秒）。默认 120ms。 */
    optionsDelayMs?: number
    /** 测试注入的 sleep 实现。默认使用 `setTimeout`。 */
    sleep?: (ms: number) => Promise<void>
    /** 玩家上一轮态度（用于态度驱动的开场微变体）。缺省按 align 处理。 */
    attitudeChoiceMode?: PlayerAttitudeChoice
    /** 当前 turnIndex（用于低熵地挑选开场 / 收尾变体）。缺省 0。 */
    turnIndex?: number
    /** 玩家累计态度值（用于结尾三种升华变体之一）。 */
    attitudeScore?: number
    /** 标记本轮是否是游戏结束升华轮；true 时不再生成选项。 */
    isEnding?: boolean
}

const defaultSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 构造一个与某个当前节点绑定的 mock `DialogueDependencies`。
 *
 * 每轮对话重新构造即可。内部仍然走真实的 `orchestrateDialogue` 管线，
 * 只是 `streamText` / `generateOptions` 的具体实现是 scripted。
 *
 * 为了让每次开场不再一模一样：
 *   - 根据玩家上一轮的态度（align/challenge）选择不同的开场口气；
 *   - 根据 turnIndex 做一个低熵选择，避免同一条语句连续出现；
 *   - 保留节点原文作为主体内容，保证史实段落的确定性。
 */
export const buildMockDialogueDependencies = (
    node: StoryNode,
    options: MockDialogueDependenciesOptions = {}
): DialogueDependencies => {
    const chunkDelayMs = options.chunkDelayMs ?? 160
    const optionsDelayMs = options.optionsDelayMs ?? 120
    const sleep = options.sleep ?? defaultSleep
    const attitudeChoiceMode: PlayerAttitudeChoice = options.attitudeChoiceMode ?? 'align'
    const turnIndex = options.turnIndex ?? 0
    const attitudeScore = options.attitudeScore ?? 0
    const isEnding = options.isEnding === true

    return {
        streamText: async function* streamText() {
            if (isEnding) {
                const chunks = buildEndingChunks(attitudeScore)
                for (let index = 0; index < chunks.length; index += 1) {
                    if (index > 0) {
                        await sleep(chunkDelayMs)
                    }
                    yield chunks[index]!
                }
                return
            }
            const base = mockChunksByNode[node.id] ?? fallbackChunks(node)
            const varied = buildVariedChunks(
                base,
                attitudeChoiceMode,
                turnIndex,
                turnIndex === 0
            )
            for (let index = 0; index < varied.length; index += 1) {
                if (index > 0) {
                    await sleep(chunkDelayMs)
                }
                yield varied[index]!
            }
        },
        generateOptions: async ({ semantics }): Promise<DialogueOption[]> => {
            if (isEnding) {
                // 升华轮不需要选项；但契约仍然要求返回两条。
                // 这里返回"回到昆仑起点"作为玩家唯一可继续的动作，两项语义保持不同
                // 以保留 UI 侧选择色彩区分。
                return semantics.map((semantic) => ({
                    semantic,
                    label: semantic === 'align'
                        ? '我想再从昆仑的那阵风开始走一次。'
                        : '这次的结局我收下了，以后再来找你。'
                }))
            }
            if (optionsDelayMs > 0) {
                await sleep(optionsDelayMs)
            }
            const labels = mockChoiceLabelsByNode[node.id] ?? fallbackChoiceLabels(node)
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
    runtimeState: RuntimeState
    retrievedEntries: KnowledgeEntry[]
    attitudeChoiceMode: PlayerAttitudeChoice
    recentTurns: string[]
}

export type DialogueDependenciesFactory = (
    input: DialogueDependenciesFactoryInput
) => DialogueDependencies

/**
 * 默认工厂：始终返回当前节点对应的 mock。未来接入真实本地模型时，
 * 可在运行时通过 `setDialogueDependenciesFactory` 替换。
 *
 * 为了让 "每一次进入游戏开场都不一样" 的诉求在纯 mock 模式下也能成立，
 * 工厂会把 `turnIndex` / `attitudeChoiceMode` / `attitudeScore` / `isCompleted`
 * 透传给 `buildMockDialogueDependencies`，让后者在开场句和收尾句里做变体。
 */
export const createDefaultDialogueDependenciesFactory = (
    options: MockDialogueDependenciesOptions = {}
): DialogueDependenciesFactory => {
    return ({ node, runtimeState, attitudeChoiceMode }) =>
        buildMockDialogueDependencies(node, {
            ...options,
            attitudeChoiceMode,
            turnIndex: runtimeState.turnIndex,
            attitudeScore: runtimeState.attitudeScore,
            isEnding: runtimeState.isCompleted
        })
}

// --- Real bridge-backed dependencies -----------------------------------

const serializeRuntimeState = (state: RuntimeState): DesktopSerializedRuntimeState => ({
    saveVersion: state.saveVersion,
    currentNodeId: state.currentNodeId,
    turnIndex: state.turnIndex,
    attitudeScore: state.attitudeScore,
    historySummary: state.historySummary,
    readNodeIds: [...state.readNodeIds],
    settings: { bgmEnabled: state.settings.bgmEnabled }
})

export interface BridgeDialogueDependenciesFactoryOptions {
    /** 同 mock 工厂：chunk 之间的补充延迟，默认 60ms，让真实回包也有逐字节奏。 */
    chunkDelayMs?: number
    /** 注入的 sleep 实现，用于测试。 */
    sleep?: (ms: number) => Promise<void>
}

/**
 * 真实本地模型工厂：把每一轮对话通过 `desktopBridge.runMainlineTurn` 发给主进程，
 * 让 `localDialogueDependencies` 在 Node 端加载 GGUF 并完成整轮编排，
 * 再把 chunks + options 一次性回传。渲染层继续用 `orchestrateDialogue` 消费事件，
 * 因此 `streamText` 和 `generateOptions` 通过一个内部缓存共享同一次 IPC 的产出。
 *
 * 若主进程返回 `{ ok: false, reason: 'model-missing' | ... }`，
 * 工厂会让 `streamText` 抛出一个可读错误，让 UI 进入可重试的 error 态。
 */
export const createBridgeDialogueDependenciesFactory = (
    bridge: Pick<DesktopBridge, 'runMainlineTurn'>,
    options: BridgeDialogueDependenciesFactoryOptions = {}
): DialogueDependenciesFactory => {
    const chunkDelayMs = options.chunkDelayMs ?? 60
    const sleep = options.sleep ?? defaultSleep

    return ({ node, runtimeState, attitudeChoiceMode, recentTurns }) => {
        let cachedResult: DesktopMainlineTurnResult | null = null
        let pending: Promise<DesktopMainlineTurnResult> | null = null

        const requestTurn = async (): Promise<DesktopMainlineTurnResult> => {
            if (cachedResult != null) {
                return cachedResult
            }
            if (pending == null) {
                const request: DesktopMainlineTurnRequest = {
                    nodeId: node.id,
                    attitudeChoiceMode,
                    runtimeState: serializeRuntimeState(runtimeState),
                    recentTurns: [...recentTurns]
                }
                pending = bridge.runMainlineTurn(request).then((result) => {
                    cachedResult = result
                    return result
                })
            }
            return await pending
        }

        return {
            streamText: async function* streamText() {
                const result = await requestTurn()
                if (!result.ok) {
                    throw new Error(
                        `[bridge] ${result.reason}: ${result.message}`
                    )
                }
                for (let index = 0; index < result.chunks.length; index += 1) {
                    if (index > 0) {
                        await sleep(chunkDelayMs)
                    }
                    yield result.chunks[index]!
                }
            },
            generateOptions: async ({ semantics }): Promise<DialogueOption[]> => {
                const result = await requestTurn()
                if (!result.ok) {
                    throw new Error(
                        `[bridge] ${result.reason}: ${result.message}`
                    )
                }
                // 主进程已基于 align/challenge 双语义生成了两个选项；
                // 按 orchestrator 请求的 semantics 顺序重新映射一次，保证一致。
                const alignOption = result.options.find((o) => o.semantic === 'align')
                const challengeOption = result.options.find((o) => o.semantic === 'challenge')
                return semantics.map((semantic) => {
                    if (semantic === 'align' && alignOption != null) {
                        return alignOption
                    }
                    if (semantic === 'challenge' && challengeOption != null) {
                        return challengeOption
                    }
                    return {
                        semantic,
                        label: semantic === 'align' ? '顺着继续听下去。' : '先停下来追问。'
                    }
                })
            }
        }
    }
}
