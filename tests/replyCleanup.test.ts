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

    it('strips inline System: prefixes', () => {
        const raw = '诶呀说到这里 System: 你好。'
        const cleaned = sanitizeMainlineReply(raw)
        expect(cleaned).not.toContain('System:')
        expect(cleaned).toContain('诶呀')
    })

    it('collapses consecutive blank lines and trims output', () => {
        const raw = '\n\n第一段。\n\n\n第二段。\n\n'
        const cleaned = sanitizeMainlineReply(raw)
        expect(cleaned.startsWith('第一段')).toBe(true)
        expect(cleaned.endsWith('第二段。')).toBe(true)
        expect(cleaned).not.toMatch(/\n\n\n/)
    })

    it('normalizes plural player address without touching historical groups', () => {
        const raw = [
            '你们已经听到这里，就该知道昆仑不是单纯的地名。',
            '但古人他们会把许多人群称作天下之民，这种多人场景可以保留。'
        ].join('\n')
        const cleaned = sanitizeMainlineReply(raw)

        expect(cleaned).toContain('你已经听到这里')
        expect(cleaned).not.toContain('你们已经')
        expect(cleaned).toContain('许多人群')
    })
})
