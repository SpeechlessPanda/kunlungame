/**
 * useFocusTrap
 * ------------------------------------------------------------
 * 最小焦点陷阱：在模态激活期间拦截 Tab / Shift+Tab 循环焦点；
 * 激活前记录触发元素，关闭时把焦点还给它。
 *
 * 纯函数 `resolveNextFocus` 与 `collectFocusable` 把 DOM 交
 * 互降到最低，以便在 Node 环境中直接做白盒测试。
 */
import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',')

export interface FocusableLike {
    tabIndex?: number
    hasAttribute?(name: string): boolean
}

/**
 * 纯函数：给定元素数组和当前焦点，返回下一个应聚焦的元素。
 * - 循环处理（最后一个往后跳回第一个，反之亦然）。
 * - 若当前焦点不在数组内，按方向回到首/末元素。
 * - 空数组返回 null。
 */
export function resolveNextFocus<T>(
    elements: readonly T[],
    current: T | null,
    shift: boolean
): T | null {
    if (elements.length === 0) return null
    const idx = current ? elements.indexOf(current) : -1
    if (idx === -1) {
        return shift ? elements[elements.length - 1] ?? null : elements[0] ?? null
    }
    if (shift) {
        return elements[(idx - 1 + elements.length) % elements.length] ?? null
    }
    return elements[(idx + 1) % elements.length] ?? null
}

/** 查询容器内的可聚焦元素；过滤掉被隐藏（offsetParent=null）的节点。 */
export function collectFocusable(root: HTMLElement): HTMLElement[] {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    return nodes.filter((el) => {
        if (el.hasAttribute('disabled')) return false
        if (el.getAttribute('aria-hidden') === 'true') return false
        if (el.tabIndex < 0) return false
        // offsetParent = null 通常表示不可见；contenteditable 等特殊情形这里不特殊处理。
        if (el.offsetParent === null && el !== document.activeElement) return false
        return true
    })
}

export interface UseFocusTrapOptions {
    /** 当陷阱激活且可聚焦为空时，是否阻止 Tab 默认行为。默认 true。 */
    blockWhenEmpty?: boolean
}

/**
 * 在 `active` 为 true 时，对 `containerRef` 内的可聚焦元素建立 Tab 陷阱。
 * 打开时自动聚焦首个可聚焦元素；关闭时把焦点还给打开前的元素。
 */
export function useFocusTrap(
    active: Ref<boolean>,
    containerRef: Ref<HTMLElement | null>,
    options: UseFocusTrapOptions = {}
): void {
    const blockWhenEmpty = options.blockWhenEmpty ?? true
    let previouslyFocused: HTMLElement | null = null

    const onKeyDown = (event: KeyboardEvent): void => {
        if (!active.value) return
        if (event.key !== 'Tab') return
        const root = containerRef.value
        if (!root) return
        const focusable = collectFocusable(root)
        if (focusable.length === 0) {
            if (blockWhenEmpty) event.preventDefault()
            return
        }
        const current = document.activeElement as HTMLElement | null
        const next = resolveNextFocus(focusable, current, event.shiftKey)
        if (!next) return
        event.preventDefault()
        next.focus()
    }

    watch(
        active,
        (open, wasOpen) => {
            if (typeof document === 'undefined') return
            if (open && !wasOpen) {
                previouslyFocused = document.activeElement as HTMLElement | null
                document.addEventListener('keydown', onKeyDown, true)
                void nextTick(() => {
                    const root = containerRef.value
                    if (!root) return
                    const focusable = collectFocusable(root)
                    focusable[0]?.focus()
                })
            } else if (!open && wasOpen) {
                document.removeEventListener('keydown', onKeyDown, true)
                const restore = previouslyFocused
                previouslyFocused = null
                if (restore && typeof restore.focus === 'function') {
                    restore.focus()
                }
            }
        },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.removeEventListener('keydown', onKeyDown, true)
  })
}
