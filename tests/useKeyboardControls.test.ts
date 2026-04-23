import { describe, expect, it } from 'vitest'
import {
    resolveKeyAction,
    type KeyContext
} from '../src/renderer/composables/useKeyboardControls.js'

const baseCtx: KeyContext = {
    settingsOpen: false,
    choicesReady: false,
    isRevealing: false
}

describe('resolveKeyAction', () => {
    it('returns null when nothing is active', () => {
        expect(resolveKeyAction('1', baseCtx)).toBeNull()
        expect(resolveKeyAction(' ', baseCtx)).toBeNull()
        expect(resolveKeyAction('Enter', baseCtx)).toBeNull()
        expect(resolveKeyAction('Escape', baseCtx)).toBeNull()
    })

    it('maps 1 to choose-align only when choices are ready', () => {
        expect(resolveKeyAction('1', { ...baseCtx, choicesReady: true })).toEqual({
            type: 'choose-align'
        })
        expect(resolveKeyAction('1', baseCtx)).toBeNull()
    })

    it('maps 2 to choose-challenge only when choices are ready', () => {
        expect(resolveKeyAction('2', { ...baseCtx, choicesReady: true })).toEqual({
            type: 'choose-challenge'
        })
        expect(resolveKeyAction('2', baseCtx)).toBeNull()
    })

    it('maps Space and Enter to skip only while revealing', () => {
        const ctx = { ...baseCtx, isRevealing: true }
        expect(resolveKeyAction(' ', ctx)).toEqual({ type: 'skip' })
        expect(resolveKeyAction('Spacebar', ctx)).toEqual({ type: 'skip' })
        expect(resolveKeyAction('Enter', ctx)).toEqual({ type: 'skip' })
        expect(resolveKeyAction(' ', baseCtx)).toBeNull()
        expect(resolveKeyAction('Enter', baseCtx)).toBeNull()
    })

    it('maps Escape to close-settings only when settings are open', () => {
        expect(
            resolveKeyAction('Escape', { ...baseCtx, settingsOpen: true })
        ).toEqual({ type: 'close-settings' })
        expect(resolveKeyAction('Escape', baseCtx)).toBeNull()
    })

    it('prioritises settings panel: choice keys ignored while open', () => {
        const ctx: KeyContext = {
            settingsOpen: true,
            choicesReady: true,
            isRevealing: true
        }
        expect(resolveKeyAction('1', ctx)).toBeNull()
        expect(resolveKeyAction('2', ctx)).toBeNull()
        expect(resolveKeyAction(' ', ctx)).toBeNull()
        expect(resolveKeyAction('Escape', ctx)).toEqual({ type: 'close-settings' })
    })

    it('ignores keys inside editable targets except Escape', () => {
        const ctx: KeyContext = {
            settingsOpen: true,
            choicesReady: true,
            isRevealing: true
        }
        expect(
            resolveKeyAction('1', ctx, { editable: true })
        ).toBeNull()
        expect(
            resolveKeyAction('Escape', ctx, { editable: true })
        ).toEqual({ type: 'close-settings' })
    })

    it('requires both choices present at caller level (context only checks readiness flag)', () => {
        // 组合检查：未进入 awaiting-choice 时 caller 设 choicesReady=false。
        expect(
            resolveKeyAction('1', { ...baseCtx, choicesReady: false })
        ).toBeNull()
        expect(
            resolveKeyAction('2', { ...baseCtx, choicesReady: false })
        ).toBeNull()
    })
})
