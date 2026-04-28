import type { MainlineAttitudeChoice } from '../src/modeling/mainlineTurnRunner.js'

export interface PlaythroughOptions {
    pattern: 'align' | 'challenge' | 'alt'
    maxNodes: number
    turnsPerNode: number | null
    choiceSequence: MainlineAttitudeChoice[]
}

const parseChoiceSequence = (value: string | undefined): MainlineAttitudeChoice[] => {
    if (value == null) return []
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item): item is MainlineAttitudeChoice => item === 'align' || item === 'challenge')
}

export const parsePlaythroughOptions = (args: string[] = process.argv.slice(2)): PlaythroughOptions => {
    const opts: PlaythroughOptions = { pattern: 'align', maxNodes: 8, turnsPerNode: null, choiceSequence: [] }
    for (const arg of args) {
        const [key, value] = arg.replace(/^--/, '').split('=')
        if (key === 'pattern' && (value === 'align' || value === 'challenge' || value === 'alt')) {
            opts.pattern = value
        } else if (key === 'choices') {
            opts.choiceSequence = parseChoiceSequence(value)
        } else if (key === 'maxNodes') {
            opts.maxNodes = Math.max(1, Number.parseInt(value ?? '8', 10) || 8)
        } else if (key === 'turnsPerNode') {
            opts.turnsPerNode = Math.max(1, Number.parseInt(value ?? '1', 10) || 1)
        }
    }
    return opts
}

export const pickPlaythroughChoice = (
    opts: Pick<PlaythroughOptions, 'pattern' | 'choiceSequence'>,
    totalTurnIndex: number
): MainlineAttitudeChoice => {
    if (opts.choiceSequence.length > 0) {
        return opts.choiceSequence[totalTurnIndex % opts.choiceSequence.length] ?? 'align'
    }
    if (opts.pattern === 'align') return 'align'
    if (opts.pattern === 'challenge') return 'challenge'
    return totalTurnIndex % 2 === 0 ? 'align' : 'challenge'
}