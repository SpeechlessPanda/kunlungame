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
    '哇，原来这条文化脉络这么长。',
    '我听懂了，这段源远流长的感觉很清楚。',
    '这条线终于接上了，再讲深一点。',
    '原来背后这么厚，我想继续听。',
    '这种回响有点打动我，后来呢？',
    '我跟上这层脉络了，再往里走。',
    '这么长的文化回响，我想把它听完整。'
] as const

const CHALLENGE_POOL: readonly string[] = [
    '等等，这个说法的合理性我想再质疑一下。',
    '证据够吗？我想先反问一句。',
    '先别急，这里面的逻辑站得住吗？',
    '这个结论凭什么成立？我还不太信。',
    '慢着，这套解释的代价是不是被轻轻带过了？',
    '我想质疑中间那一步，证据在哪里？',
    '先退半步，这个判断真的合理吗？'
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
