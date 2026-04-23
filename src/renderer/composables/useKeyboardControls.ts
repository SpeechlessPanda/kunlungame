/**
 * useKeyboardControls
 * ------------------------------------------------------------
 * 键盘快捷键解析与注册。纯函数 `resolveKeyAction` 可以在
 * Node 环境下直接进行单测；Vue 包装器负责在组件挂载期间挂
 * 接 `keydown` 监听并保证 unmount 时释放。
 *
 * 规则：
 *   - 设置面板打开时：仅响应 `Escape` → close-settings。
 *   - `awaiting-choice` 且已有两项选项时：
 *       `1` → choose-align；`2` → choose-challenge。
 *   - 打字机正在显示（isRevealing=true）时：
 *       `Space` / `Enter` → skip。
 *   - 其它情况下返回 null，不阻止原生行为。
 *   - 输入框、文本域、contenteditable 内触发时仅允许 Escape
 *     通过，避免干扰用户输入。
 */
import { onBeforeUnmount, onMounted } from 'vue'

export type KeyAction =
    | { type: 'choose-align' }
    | { type: 'choose-challenge' }
    | { type: 'skip' }
    | { type: 'close-settings' }

export interface KeyContext {
    /** 是否有模态设置面板打开；打开时优先处理 Escape。 */
    settingsOpen: boolean
    /** 是否正在等待玩家选择（需要两个选项都存在）。 */
    choicesReady: boolean
    /** 打字机是否仍在揭示。 */
    isRevealing: boolean
}

export interface ResolveOptions {
    /** 事件目标是否是输入控件；若是则除 Escape 外全部放行。 */
    editable?: boolean
}

const SKIP_KEYS = new Set<string>([' ', 'Spacebar', 'Space', 'Enter'])

export function resolveKeyAction(
    key: string,
    ctx: KeyContext,
    options: ResolveOptions = {}
): KeyAction | null {
    if (options.editable && key !== 'Escape') {
        return null
    }

    if (ctx.settingsOpen) {
        if (key === 'Escape') {
            return { type: 'close-settings' }
        }
        return null
    }

    if (ctx.choicesReady) {
        if (key === '1') return { type: 'choose-align' }
        if (key === '2') return { type: 'choose-challenge' }
    }

    if (ctx.isRevealing && SKIP_KEYS.has(key)) {
        return { type: 'skip' }
    }

    return null
}

export interface KeyboardHandlers {
    onChooseAlign: () => void
    onChooseChallenge: () => void
    onSkip: () => void
    onCloseSettings: () => void
}

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (target.isContentEditable) return true
    return false
}

/**
 * Vue 组件内调用：在 mount 时注册 keydown，unmount 时释放。
 * 返回一个手动 detach 函数，便于显式清理（例如热重载场景）。
 */
export function useKeyboardControls(
    getContext: () => KeyContext,
    handlers: KeyboardHandlers
): () => void {
    const onKeyDown = (event: KeyboardEvent): void => {
        const action = resolveKeyAction(event.key, getContext(), {
            editable: isEditableTarget(event.target)
        })
        if (!action) return
        event.preventDefault()
        switch (action.type) {
            case 'choose-align':
                handlers.onChooseAlign()
                return
            case 'choose-challenge':
                handlers.onChooseChallenge()
                return
            case 'skip':
                handlers.onSkip()
                return
            case 'close-settings':
                handlers.onCloseSettings()
                return
        }
    }

    const attach = (): void => {
        if (typeof window === 'undefined') return
        window.addEventListener('keydown', onKeyDown)
    }
    const detach = (): void => {
        if (typeof window === 'undefined') return
        window.removeEventListener('keydown', onKeyDown)
    }

    onMounted(attach)
    onBeforeUnmount(detach)

    return detach
}
