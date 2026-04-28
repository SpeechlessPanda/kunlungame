import type { ChoiceModel } from './useTurnController.js'

export interface BuildRecentTurnMemoryInput {
    modelReply: string
    choice: ChoiceModel
    maxReplyChars?: number
}

const cleanReply = (text: string): string => text
    .replace(/\s+/gu, ' ')
    .trim()

const takeChars = (text: string, maxChars: number): string => {
    const chars = Array.from(text)
    if (chars.length <= maxChars) return text
    return `${chars.slice(0, maxChars).join('')}…`
}

export const buildRecentTurnMemory = (input: BuildRecentTurnMemoryInput): string => {
    const maxReplyChars = input.maxReplyChars ?? 360
    const reply = takeChars(cleanReply(input.modelReply), maxReplyChars)
    const attitudeLabel = input.choice.id === 'align' ? '顺着听' : '带着怀疑追问'

    return [
        `昆仑子上一轮：${reply}`,
        `玩家刚才选择了【${attitudeLabel}】：${input.choice.label}`,
        '下一轮必须沿着同一内容推进，只改变态度回应，不把选择当成新分支。'
    ].join('\n')
}