import { describe, expect, it } from 'vitest'
import { resolveNextFocus } from '../src/renderer/composables/useFocusTrap.js'

describe('resolveNextFocus', () => {
    const items = ['a', 'b', 'c', 'd'] as const

    it('returns null for empty list', () => {
        expect(resolveNextFocus([], null, false)).toBeNull()
        expect(resolveNextFocus([], 'x' as never, true)).toBeNull()
    })

    it('without current focus: forward → first, backward → last', () => {
        expect(resolveNextFocus(items, null, false)).toBe('a')
        expect(resolveNextFocus(items, null, true)).toBe('d')
    })

    it('forward tab advances by one', () => {
        expect(resolveNextFocus(items, 'a', false)).toBe('b')
        expect(resolveNextFocus(items, 'b', false)).toBe('c')
        expect(resolveNextFocus(items, 'c', false)).toBe('d')
    })

    it('shift+tab retreats by one', () => {
        expect(resolveNextFocus(items, 'd', true)).toBe('c')
        expect(resolveNextFocus(items, 'b', true)).toBe('a')
    })

    it('wraps around at the boundaries', () => {
        // 正向：最后一个 → 第一个
        expect(resolveNextFocus(items, 'd', false)).toBe('a')
        // 反向：第一个 → 最后一个
        expect(resolveNextFocus(items, 'a', true)).toBe('d')
    })

    it('handles current element not in list by resetting to boundary', () => {
        expect(resolveNextFocus(items, 'z', false)).toBe('a')
        expect(resolveNextFocus(items, 'z', true)).toBe('d')
    })

    it('single-element list always returns itself', () => {
        const solo = ['only'] as const
        expect(resolveNextFocus(solo, 'only', false)).toBe('only')
        expect(resolveNextFocus(solo, 'only', true)).toBe('only')
        expect(resolveNextFocus(solo, null, false)).toBe('only')
    })
})
