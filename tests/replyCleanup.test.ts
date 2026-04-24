import { describe, expect, it } from 'vitest'
import { sanitizeMainlineReply } from '../src/modeling/replyCleanup.js'

describe('sanitizeMainlineReply', () => {
    it('strips leading role labels like "昆仑："', () => {
        const raw = [
            '昆仑：诶呀，你来啦。',
            '昆仑：我再想想《山海经》里那句话。',
            '今天就聊聊这些吧。'
        ].join('\n')
        const cleaned = sanitizeMainlineReply(raw)
        expect(cleaned).not.toContain('昆仑：')
        expect(cleaned).toContain('诶呀，你来啦。')
        expect(cleaned).toContain('我再想想')
    })

    it('drops markdown headings and --- separators', () => {
        const raw = ['# 开场白', '诶呀你好。', '---', '然后我们继续。', '==='].join('\n')
        const cleaned = sanitizeMainlineReply(raw)
        expect(cleaned).not.toContain('#')
        expect(cleaned).not.toContain('---')
        expect(cleaned).not.toContain('===')
        expect(cleaned).toContain('诶呀你好。')
    })

    it('removes sentences that appeared verbatim in a recent turn', () => {
        const priorReply =
            '昆仑在古人心中是世界中心。哼——可不正是因为这样才显得咱们文化特别丰富多样呢。'
        const raw =
            '诶呀，说到盘古开天地这事儿真有意思呢。哼——可不正是因为这样才显得咱们文化特别丰富多样呢。那接下来你想听哪一段？'
        const cleaned = sanitizeMainlineReply(raw, { recentTurns: [priorReply] })
        expect(cleaned).toContain('盘古开天地')
        expect(cleaned).not.toContain('可不正是因为这样才显得咱们文化特别丰富多样')
        expect(cleaned).toContain('接下来你想听哪一段')
    })

    it('keeps short repeated interjections like 嘻嘻', () => {
        const priorReply = '嘻嘻。你看这里。'
        const raw = '嘻嘻。今天我们聊别的。'
        const cleaned = sanitizeMainlineReply(raw, { recentTurns: [priorReply] })
        expect(cleaned).toContain('嘻嘻')
        expect(cleaned).toContain('聊别的')
    })

    it('strips inline PREV_REPLY tags and System: prefixes even when embedded', () => {
        const raw = '诶呀 [[PREV_REPLY_1]] 说到这里 System: 你好。'
        const cleaned = sanitizeMainlineReply(raw)
        expect(cleaned).not.toContain('PREV_REPLY')
        expect(cleaned).not.toContain('System:')
        expect(cleaned).toContain('诶呀')
        expect(cleaned).toContain('说到这里')
    })

    it('collapses consecutive blank lines and trims output', () => {
        const raw = '\n\n第一段。\n\n\n第二段。\n\n'
        const cleaned = sanitizeMainlineReply(raw)
        expect(cleaned.startsWith('第一段')).toBe(true)
        expect(cleaned.endsWith('第二段。')).toBe(true)
        expect(cleaned).not.toMatch(/\n\n\n/)
    })
})
