import { describe, expect, it } from 'vitest'
import { parsePlaythroughOptions, pickPlaythroughChoice } from '../scripts/playthroughOptions.js'

describe('playthroughOptions', () => {
    it('parses a custom mixed choice sequence', () => {
        const options = parsePlaythroughOptions(['--choices=align,challenge,challenge,align', '--maxNodes=4', '--turnsPerNode=1'])

        expect(options.choiceSequence).toEqual(['align', 'challenge', 'challenge', 'align'])
        expect(pickPlaythroughChoice(options, 0)).toBe('align')
        expect(pickPlaythroughChoice(options, 1)).toBe('challenge')
        expect(pickPlaythroughChoice(options, 2)).toBe('challenge')
        expect(pickPlaythroughChoice(options, 3)).toBe('align')
    })

    it('cycles the custom sequence when a run has more turns than choices', () => {
        const options = parsePlaythroughOptions(['--choices=challenge,align'])

        expect(pickPlaythroughChoice(options, 0)).toBe('challenge')
        expect(pickPlaythroughChoice(options, 1)).toBe('align')
        expect(pickPlaythroughChoice(options, 2)).toBe('challenge')
    })
})