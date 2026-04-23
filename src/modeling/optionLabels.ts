import type { DialogueOption } from './dialogueOrchestrator.js'

/**
 * galgame 风格的 option label 生成器。
 *
 * 设计要求（来自 2026-04-24 手测反馈）：
 * - 不再把 `currentNode.theme` / `coreQuestion` / `mustIncludeFacts` 任何一段原文塞进 label，
 *   那样做出来的选项像 AI 补写的提示条，而不像玩家内心的回应。
 * - 每轮略微变化，让多轮同主题的重玩不至于每次都选同一行字。
 * - 两个选项的语义分工清晰：`align` = 顺着昆仑往下听；`challenge` = 把怀疑/反驳摆上桌。
 */

const ALIGN_POOL: readonly string[] = [
    '嗯，你继续说——',
    '我想听你把这段讲完。',
    '好，沿着这条线再往里讲一点。',
    '那这里之后是什么？',
    '嗯嗯，后来呢？',
    '我跟上了，再深一层。',
    '这句我想记下来——继续。'
] as const

const CHALLENGE_POOL: readonly string[] = [
    '等等——这段我不太确定。',
    '我想先反问你一句。',
    '先别急，我想拧一下里面的逻辑。',
    '这一层我没那么买账，给我个更硬的理由。',
    '慢着，这里能不能换个看法？',
    '有点跳了，我要把中间那步补出来。',
    '先退半步——这结论是不是下得太快？'
] as const

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
}

export const buildGalgameOptionLabels = (
    input: BuildOptionLabelsInput
): DialogueOption[] => {
    const { turnIndex, isEnding = false } = input
    if (isEnding) {
        return [
            { semantic: 'align', label: pickBy(ENDING_ALIGN, turnIndex) },
            { semantic: 'challenge', label: pickBy(ENDING_CHALLENGE, turnIndex) }
        ]
    }
    return [
        { semantic: 'align', label: pickBy(ALIGN_POOL, turnIndex) },
        // challenge 池大小与 align 不同，+3 偏移让两条选项不至于完全同步轮换
        { semantic: 'challenge', label: pickBy(CHALLENGE_POOL, turnIndex + 3) }
    ]
}
