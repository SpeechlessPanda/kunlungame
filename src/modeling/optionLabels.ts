import type { DialogueOption } from './dialogueOrchestrator.js'

/**
 * galgame 风格的 option label 生成器。
 *
 * 设计要求（来自 2026-04-24 手测反馈，2026-04-28 加入 8 节点定制化）：
 * - 不再把 `currentNode.theme` / `coreQuestion` / `mustIncludeFacts` 任何一段原文塞进 label，
 *   那样做出来的选项像 AI 补写的提示条，而不像玩家内心的回应。
 * - 每轮略微变化，让多轮同主题的重玩不至于每次都选同一行字。
 * - 两个选项的语义分工清晰：`align` = 顺着昆仑往下听；`challenge` = 把怀疑/反驳摆上桌。
 * - 8 节点各自带一个 4 条 align + 4 条 challenge 的语境化选项池。
 *   align 永远命中正则 /原来|源远流长|脉络|听懂|接上|厚|长|回响/，
 *   challenge 永远命中 /合理|证据|凭什么|代价|逻辑|质疑|站得住/，
 *   两个池都不允许出现 ['文明原点','世界中心','昆仑文化','禁止','知识条目','回望自己','mustInclude']。
 *   未在表中登记的 nodeId 会落回通用池，保证向后兼容。
 */

const ALIGN_POOL: readonly string[] = [
    '哇，原来这条文化脉络这么长。',
    '我听懂了，这段源远流长的感觉很清楚。',
    '这条线终于接上了，再讲深一点。',
    '原来背后这么厚，我想继续听。',
    '这种回响有点打动我，后来呢？',
    '我跟上这层脉络了，再往里走。',
    '这么长的文化回响，我想把它听完整。'
] as const

const CHALLENGE_POOL: readonly string[] = [
    '我也沿着这条文化脉络听，但合理性要再稳一点。',
    '我也想听这段源远流长，不过证据够吗？',
    '这条线可以继续接上，但中间逻辑站得住吗？',
    '这背后的厚度我听见了，可结论凭什么成立？',
    '这种回响可以继续讲，但代价是不是被轻轻带过了？',
    '我跟着这层脉络走，不过想质疑中间那一步。',
    '这段文化回响我愿意听完整，但判断真的合理吗？'
] as const

interface NodeOptionPool {
    readonly align: readonly string[]
    readonly challenge: readonly string[]
}

const NODE_OPTION_POOLS: Record<string, NodeOptionPool> = {
    'kunlun-threshold': {
        align: [
            '原来天柱、神话和地图能在昆仑里接上同一条线。',
            '我听懂了，西王母这段流变的脉络真的很长。',
            '把樊桐、玄圃、阆风三层串起来，这层意象厚得让人安静。',
            '盐湖与古羊皮的气味也压在这条回响里，我想再走一步。'
        ],
        challenge: [
            '天柱、神话和地图这条线我也听，但合理性先得给我站得住的证据。',
            '西王母这段流变我也想听，可前后形象差这么大，逻辑要更稳。',
            '樊桐、玄圃、阆风三层我能接上，但它是真有所指还是文学想象？',
            '盐湖与古羊皮的回响可以继续，不过这层解释的证据在哪里？'
        ]
    },
    'creation-myths': {
        align: [
            '原来盘古、女娲、大禹三段神话能接上同一种文明使命。',
            '我听懂了，从混沌到补天再到治水，这条脉络其实很长。',
            '"创世—救世—驯服自然"压在一起的回响，比我想的更厚。',
            '夸父逐日、精卫填海那种徒劳的坚持，让源远流长四个字立住了。'
        ],
        challenge: [
            '盘古、女娲、大禹这条使命线我也听，但证据来自哪一层文献？',
            '从混沌到补天再到治水这条脉络能接上，可解读真的站得住吗？',
            '创世、救世、驯服自然的回响我听见了，但逻辑是不是太顺？',
            '夸父逐日、精卫填海的坚持可以讲，可凭什么这样接到文明使命？'
        ]
    },
    'civilization-roots': {
        align: [
            '原来"炎黄子孙"是一代代人重写出来的共同身份，这层接得上。',
            '燧人取火、伏羲画卦、神农尝药这条脉络，听懂了就觉得真的很长。',
            '把多部族合一的回响放进同一张族谱，这种厚度我感受到了。',
            '尧舜禹的更替原来不是单线，那种源远流长才像真历史。'
        ],
        challenge: [
            '炎黄子孙这个共同身份我也听，但被重写的合理性需要更多证据。',
            '燧人、伏羲、神农这条脉络很长，可中间逻辑我想先质疑一下。',
            '多部族合一的回响可以讲，但收进同一族谱的代价值得吗？',
            '尧舜禹这条线像真历史，可后世凭什么认这本族谱？'
        ]
    },
    'order-and-thought': {
        align: [
            '原来诸子争鸣不是乱，是把秩序观接上同一张地图。',
            '我听懂了——礼乐、易理与墨法的回响其实彼此呼应。',
            '把"仪式语言"和"道德情感"串起来的这条脉络，比我想的更厚。',
            '诸子从来不是单声道的源远流长，这种长才像真的。'
        ],
        challenge: [
            '诸子争鸣这张秩序地图我也听，但合理性是不是被讲得太顺？',
            '礼乐、易理与墨法的回响我能接上，可代价是不是被轻描淡写了？',
            '仪式语言和道德情感这条脉络很厚，但其他声音去哪了？要看证据。',
            '诸子的多声道我愿意听，可把它们排成互补框架的逻辑要先质疑。'
        ]
    },
    'empire-and-openness': {
        align: [
            '原来文字、度量衡、史记这套连起来的脉络这么长。',
            '我听懂了，长安那种多语言并存的开放就是出厂设置。',
            '丝路把波斯、印度、罗马接上中原的回响，听着就觉得厚。',
            '从秦书同文到汉武辟丝路，这条源远流长的轴线很稳。'
        ],
        challenge: [
            '文字、度量衡、史记这套脉络我也听，但大一统的合理性站得住吗？',
            '长安多语言并存的开放我听懂了，可科举逻辑真的这么干净？',
            '丝路连接波斯、印度、罗马的回响很厚，但被吞掉的小族群付出什么代价？',
            '秦汉到丝路这条轴线可以继续，可凭什么说唐代开放是出厂设置？'
        ]
    },
    'fusion-and-refinement': {
        align: [
            '原来精致地重写同一主题也是文明的生产方式，这条接得上。',
            '从宋词到红楼梦，这种源远流长的细化把人按住。',
            '青花瓷、戏曲合奏、郑和远航的回响一层层叠起来，确实厚。',
            '我听懂了——永乐大典和水浒红楼是同一种"自我归档"的脉络。'
        ],
        challenge: [
            '精致地重写主题这条线我也听，但宋代好奇心的合理性要更多证据。',
            '宋词到红楼梦的细化很源远流长，可是不是把融合代价藏起来了？',
            '青花瓷、戏曲、郑和的回响很厚，但凭什么把精致也算生产力？',
            '永乐大典和水浒红楼的归档脉络我听懂了，可《四库全书》站得住吗？'
        ]
    },
    'rupture-and-guardianship': {
        align: [
            '原来五四的激进与重新认识传统是同一段脉络。',
            '我听懂了——营造学社、故宫南迁那群人在断裂里把文脉接上了。',
            '梁思成那一辈守住的回响，分量比我以前想的更厚。',
            '严复、梁启超用译著把近代概念续进中文，这条线源远流长。'
        ],
        challenge: [
            '五四激进与重新认识传统这条脉络我也听，但定性的合理性站得住吗？',
            '营造学社和故宫南迁接住文脉我听懂了，可苦难叙事的代价要看清。',
            '梁思成那一辈守住的回响很厚，但凭什么不是冲突被压住的结果？',
            '严复、梁启超把概念续进中文这条线可以讲，但英雄叙事逻辑要先质疑。'
        ]
    },
    'contemporary-return': {
        align: [
            '原来"文化自觉"是把前面所有讨论接上当代生活的钥匙。',
            '我听懂了，《国家宝藏》和敦煌数字化只是回响的最新一层。',
            '从典籍到屏幕，这条脉络竟然能这么长。',
            '故宫文创、B 站国风把传统继续写厚，这条线源远流长。'
        ],
        challenge: [
            '文化自觉接上当代生活这条线我也听，但文化自信的合理性要给证据。',
            '《国家宝藏》和敦煌数字化的回响我听懂了，可非遗会不会变成展品？',
            '从典籍到屏幕这条脉络很长，但流量国风等同于文化自觉的逻辑站得住吗？',
            '故宫文创、B 站国风把传统写厚可以讲，但回到屏幕的代价是什么？'
        ]
    }
}

const ENDING_ALIGN: readonly string[] = [
    '我想再从昆仑的那阵风开始走一次。',
    '再陪我走一遍，好吗？',
    '让我从头再听你讲一次。'
] as const

const ENDING_CHALLENGE: readonly string[] = [
    '这次的结局我收下了，以后再来找你。',
    '好，我带着这些疑问先离开。',
    '我把这一程先放进心里，下次再见。'
] as const

const pickBy = (pool: readonly string[], seed: number): string => {
    if (pool.length === 0) {
        return ''
    }
    const index = ((seed % pool.length) + pool.length) % pool.length
    return pool[index] ?? pool[0]!
}

export interface BuildOptionLabelsInput {
    turnIndex: number
    isEnding?: boolean
    /**
     * 当前节点 id。命中 NODE_OPTION_POOLS 时使用节点专属池，否则回退到通用池。
     * 不传也兼容（旧调用方与单元测试）。
     */
    nodeId?: string
}

export const buildGalgameOptionLabels = (
    input: BuildOptionLabelsInput
): DialogueOption[] => {
    const { turnIndex, isEnding = false, nodeId } = input
    if (isEnding) {
        return [
            { semantic: 'align', label: pickBy(ENDING_ALIGN, turnIndex) },
            { semantic: 'challenge', label: pickBy(ENDING_CHALLENGE, turnIndex) }
        ]
    }
    const pool = nodeId != null ? NODE_OPTION_POOLS[nodeId] : undefined
    const alignPool = pool?.align ?? ALIGN_POOL
    const challengePool = pool?.challenge ?? CHALLENGE_POOL
    return [
        { semantic: 'align', label: pickBy(alignPool, turnIndex) },
        { semantic: 'challenge', label: pickBy(challengePool, turnIndex) }
    ]
}
