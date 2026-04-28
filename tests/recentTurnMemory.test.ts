import { describe, expect, it } from 'vitest'
import { buildRecentTurnMemory } from '../src/renderer/composables/recentTurnMemory.js'

describe('buildRecentTurnMemory', () => {
    it('keeps the last reply and selected option together for the next turn context', () => {
        const memory = buildRecentTurnMemory({
            modelReply: '昆仑把神话、地理和身份三条线接在一起。\n你愿意继续听吗？',
            choice: {
                id: 'challenge',
                label: '我也沿着昆仑这条轴心线听，但证据要更稳。'
            }
        })

        expect(memory).toContain('昆仑子上一轮：昆仑把神话、地理和身份三条线接在一起。')
        expect(memory).toContain('玩家刚才选择了【带着怀疑追问】')
        expect(memory).toContain('我也沿着昆仑这条轴心线听，但证据要更稳。')
        expect(memory).toContain('同一内容推进')
    })

    it('bounds very long replies before passing them back to the prompt', () => {
        const memory = buildRecentTurnMemory({
            modelReply: '昆仑'.repeat(500),
            choice: { id: 'align', label: '我愿意顺着昆仑继续听。' },
            maxReplyChars: 80
        })

        expect(memory.length).toBeLessThan(220)
        expect(memory).toContain('…')
        expect(memory).toContain('【顺着听】')
    })
})