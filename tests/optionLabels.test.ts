import { describe, expect, it } from 'vitest'
import { buildGalgameOptionLabels } from '../src/modeling/optionLabels.js'

describe('buildGalgameOptionLabels', () => {
    it('总是返回一条 align + 一条 challenge', () => {
        const options = buildGalgameOptionLabels({ turnIndex: 0 })
        expect(options.map((option) => option.semantic).sort()).toEqual(['align', 'challenge'])
    })

    it('label 不应包含任何 theme / coreQuestion / mustInclude 片段', () => {
        // 主线里会出现的 theme / coreQuestion 关键字，不希望在选项里出现：
        const forbiddenFragments = ['文明原点', '世界中心', '昆仑文化', '禁止', '知识条目', '回望自己', 'mustInclude']
        for (let turnIndex = 0; turnIndex < 20; turnIndex += 1) {
            const labels = buildGalgameOptionLabels({ turnIndex }).map((option) => option.label)
            for (const label of labels) {
                for (const fragment of forbiddenFragments) {
                    expect(label, `turn ${turnIndex} 的 label "${label}" 不应包含 "${fragment}"`).not.toContain(fragment)
                }
            }
        }
    })

    it('不同 turnIndex 不应总是产生完全相同的两条 label', () => {
        const seen = new Set<string>()
        for (let turnIndex = 0; turnIndex < 7; turnIndex += 1) {
            const labels = buildGalgameOptionLabels({ turnIndex })
            seen.add(labels.map((option) => option.label).join('|'))
        }
        // 7 轮至少应出现 3 种以上的组合。
        expect(seen.size).toBeGreaterThanOrEqual(3)
    })

    it('align 像自然赞同文化纵深，challenge 像质疑合理性或证据', () => {
        for (let turnIndex = 0; turnIndex < 12; turnIndex += 1) {
            const options = buildGalgameOptionLabels({ turnIndex })
            const align = options.find((option) => option.semantic === 'align')!.label
            const challenge = options.find((option) => option.semantic === 'challenge')!.label

            expect(align).toMatch(/原来|源远流长|脉络|听懂|接上|厚|长|回响/)
            expect(challenge).toMatch(/合理|证据|凭什么|代价|逻辑|质疑|站得住/)
            expect(`${align}${challenge}`).not.toContain('你们')
            expect(`${align}${challenge}`).not.toContain('给我个更硬的理由')
        }
    })

    it('isEnding=true 时切换为"再走一次 / 收下离开"语义', () => {
        const options = buildGalgameOptionLabels({ turnIndex: 0, isEnding: true })
        const align = options.find((option) => option.semantic === 'align')!
        const challenge = options.find((option) => option.semantic === 'challenge')!
        expect(align.label).toMatch(/再|头|一次|再走/)
        expect(challenge.label).toMatch(/收下|离开|下次|放进/)
    })

    it('对相同输入稳定（同一 turnIndex 产生同一组 label，方便快照与断言）', () => {
        const a = buildGalgameOptionLabels({ turnIndex: 5 })
        const b = buildGalgameOptionLabels({ turnIndex: 5 })
        expect(a).toEqual(b)
    })
})
