import { describe, expect, it } from 'vitest'
import { buildGalgameOptionLabels } from '../src/modeling/optionLabels.js'

describe('buildGalgameOptionLabels', () => {
    it('总是返回一条 align + 一条 challenge', () => {
        const options = buildGalgameOptionLabels({ turnIndex: 0 })
        expect(options.map((option) => option.semantic).sort()).toEqual(['align', 'challenge'])
    })

    it('不同 turnIndex 不应总是产生完全相同的两条 label', () => {
        const seen = new Set<string>()
        for (let turnIndex = 0; turnIndex < 7; turnIndex += 1) {
            const labels = buildGalgameOptionLabels({ turnIndex })
            seen.add(labels.map((option) => option.label).join('|'))
        }
        expect(seen.size).toBeGreaterThanOrEqual(3)
    })

    it('isEnding=true 时切换为"再走一次 / 收下离开"语义', () => {
        const options = buildGalgameOptionLabels({ turnIndex: 0, isEnding: true })
        const align = options.find((option) => option.semantic === 'align')!
        const challenge = options.find((option) => option.semantic === 'challenge')!
        expect(align.label).toMatch(/再|头|一次|再走/)
        expect(challenge.label).toMatch(/收下|离开|下次|再见/)
    })

    it('对相同输入稳定', () => {
        const a = buildGalgameOptionLabels({ turnIndex: 5 })
        const b = buildGalgameOptionLabels({ turnIndex: 5 })
        expect(a).toEqual(b)
    })

    it('8 个主线节点都拥有自己的语境化选项池', () => {
        const nodeIds = [
            'kunlun-threshold',
            'creation-myths',
            'civilization-roots',
            'order-and-thought',
            'empire-and-openness',
            'fusion-and-refinement',
            'rupture-and-guardianship',
            'contemporary-return'
        ]
        const seen = new Set<string>()
        for (const nodeId of nodeIds) {
            const options = buildGalgameOptionLabels({ turnIndex: 0, nodeId })
            const align = options.find((option) => option.semantic === 'align')!.label
            const challenge = options.find((option) => option.semantic === 'challenge')!.label
            expect(align.length).toBeGreaterThan(0)
            expect(challenge.length).toBeGreaterThan(0)
            seen.add(`${align}|${challenge}`)
        }
        expect(seen.size).toBeGreaterThanOrEqual(6)
    })

    it('节点定制池里出现的关键意象应该带上节点语境（抽样验证）', () => {
        const samples: Array<{ nodeId: string; mustMatch: RegExp }> = [
            { nodeId: 'kunlun-threshold', mustMatch: /昆仑|西王母|天柱|世界中心/ },
            { nodeId: 'creation-myths', mustMatch: /盘古|女娲|大禹|创世|补天|治水/ },
            { nodeId: 'civilization-roots', mustMatch: /炎黄|燧人|伏羲|神农|部族|身份/ },
            { nodeId: 'order-and-thought', mustMatch: /诸子|礼乐|争鸣|秩序|老子/ },
            { nodeId: 'empire-and-openness', mustMatch: /书同文|长安|丝路|大一统|科举/ },
            { nodeId: 'fusion-and-refinement', mustMatch: /宋|红楼|青花|郑和|精致/ },
            { nodeId: 'rupture-and-guardianship', mustMatch: /五四|梁思成|文脉|鲁迅|守护/ },
            { nodeId: 'contemporary-return', mustMatch: /文化自觉|故宫|敦煌|非遗|国风/ }
        ]
        for (const { nodeId, mustMatch } of samples) {
            const labels: string[] = []
            for (let turnIndex = 0; turnIndex < 8; turnIndex += 1) {
                for (const option of buildGalgameOptionLabels({ turnIndex, nodeId })) {
                    labels.push(option.label)
                }
            }
            expect(
                labels.some((label) => mustMatch.test(label)),
                `节点 ${nodeId} 的选项池里应至少有一行命中 ${mustMatch}，实际：${labels.join(' / ')}`
            ).toBe(true)
        }
    })

    it('未登记的 nodeId 会回退到通用池而不报错', () => {
        const options = buildGalgameOptionLabels({ turnIndex: 0, nodeId: 'unknown-node-xyz' })
        expect(options).toHaveLength(2)
        const align = options.find((option) => option.semantic === 'align')!.label
        const challenge = options.find((option) => option.semantic === 'challenge')!.label
        expect(align.length).toBeGreaterThan(0)
        expect(challenge.length).toBeGreaterThan(0)
    })
})
