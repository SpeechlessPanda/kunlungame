import { describe, expect, it } from 'vitest'
import { buildMockDialogueDependencies } from '../src/renderer/adapters/rendererDialogueDependencies.js'
import { minimalStoryOutline } from '../src/shared/contracts/contentContracts.js'

const node = minimalStoryOutline.nodes[0]!

const emptyPrompt = { system: '', user: '' }

const collect = async (
    iter: AsyncIterable<string>
): Promise<string[]> => {
    const chunks: string[] = []
    for await (const chunk of iter) {
        chunks.push(chunk)
    }
    return chunks
}

describe('buildMockDialogueDependencies · ending branch', () => {
    it('streams the ending epilogue instead of the node script when isEnding=true', async () => {
        const deps = buildMockDialogueDependencies(node, {
            isEnding: true,
            attitudeScore: 2,
            turnIndex: 8,
            attitudeChoiceMode: 'align',
            chunkDelayMs: 0,
            optionsDelayMs: 0
        })

        const chunks = await collect(deps.streamText(emptyPrompt))
        expect(chunks.length).toBeGreaterThan(0)
        const text = chunks.join('')
        expect(text).toMatch(/走到这里|陪我走|谢谢你/)
    })

    it('uses the skeptical ending tone when attitudeScore is deeply negative', async () => {
        const deps = buildMockDialogueDependencies(node, {
            isEnding: true,
            attitudeScore: -3,
            turnIndex: 8,
            attitudeChoiceMode: 'challenge',
            chunkDelayMs: 0,
            optionsDelayMs: 0
        })
        const chunks = await collect(deps.streamText(emptyPrompt))
        const text = chunks.join('')
        expect(text.length).toBeGreaterThan(20)
    })

    it('replaces option labels with restart semantics when isEnding=true', async () => {
        const deps = buildMockDialogueDependencies(node, {
            isEnding: true,
            attitudeScore: 0,
            turnIndex: 8,
            optionsDelayMs: 0
        })

        const options = await deps.generateOptions({
            currentNode: node,
            semantics: ['align', 'challenge']
        })

        expect(options).toHaveLength(2)
        const align = options.find((o) => o.semantic === 'align')!
        const challenge = options.find((o) => o.semantic === 'challenge')!
        expect(align.label).toContain('再从昆仑')
        expect(challenge.label).toContain('收下')
    })

    it('varies the opener between different turnIndex / attitudeChoiceMode combinations', async () => {
        const takeFirstChunk = async (
            turnIndex: number,
            mode: 'align' | 'challenge'
        ): Promise<string> => {
            const deps = buildMockDialogueDependencies(node, {
                turnIndex,
                attitudeChoiceMode: mode,
                attitudeScore: 0,
                chunkDelayMs: 0,
                optionsDelayMs: 0
            })
            const chunks = await collect(deps.streamText(emptyPrompt))
            return chunks[0] ?? ''
        }

        const a = await takeFirstChunk(2, 'align')
        const b = await takeFirstChunk(4, 'challenge')
        expect(a).not.toBe(b)
    })
})
