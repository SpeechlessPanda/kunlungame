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

    it('8 个主线节点都拥有自己的语境化选项池，且不同节点产出的 label 不应完全雷同', () => {
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
            expect(align).toMatch(/原来|源远流长|脉络|听懂|接上|厚|长|回响/)
            expect(challenge).toMatch(/合理|证据|凭什么|代价|逻辑|质疑|站得住/)
            seen.add(`${align}|${challenge}`)
        }
        // 8 个节点的 turn0 组合应当至少出现 6 种以上不同 label。
        expect(seen.size).toBeGreaterThanOrEqual(6)
    })

    it('节点定制池里出现的关键意象应该带上节点语境（抽样验证）', () => {
        const samples: Array<{ nodeId: string; mustMatch: RegExp }> = [
            { nodeId: 'kunlun-threshold', mustMatch: /昆仑|天柱|西王母|樊桐|玄圃|阆风|盐湖/ },
            { nodeId: 'creation-myths', mustMatch: /盘古|女娲|大禹|共工|夸父|精卫|混沌|补天|治水/ },
            { nodeId: 'civilization-roots', mustMatch: /炎黄|燧人|伏羲|神农|尧舜禹|族谱|部族/ },
            { nodeId: 'order-and-thought', mustMatch: /诸子|礼乐|易理|墨法|老庄|仪式语言|道德情感/ },
            { nodeId: 'empire-and-openness', mustMatch: /秦|汉|长安|丝路|科举|度量衡|史记|唐代/ },
            { nodeId: 'fusion-and-refinement', mustMatch: /宋|红楼|青花|郑和|永乐大典|戏曲|四库全书/ },
            { nodeId: 'rupture-and-guardianship', mustMatch: /五四|营造学社|故宫南迁|梁思成|严复|梁启超|鲁迅|胡适|孔家店/ },
            { nodeId: 'contemporary-return', mustMatch: /文化自觉|国家宝藏|敦煌|故宫文创|B 站|非遗|文化自信/ }
        ]
        for (const { nodeId, mustMatch } of samples) {
            // 把 turn 0..7 的 8 组 label 全部拉出来，确保至少有一行真的引用了节点专属意象。
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
        expect(align).toMatch(/原来|源远流长|脉络|听懂|接上|厚|长|回响/)
        expect(challenge).toMatch(/合理|证据|凭什么|代价|逻辑|质疑|站得住/)
    })
})
