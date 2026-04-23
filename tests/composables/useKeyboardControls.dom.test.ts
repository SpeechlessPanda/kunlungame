// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { useKeyboardControls } from '../../src/renderer/composables/useKeyboardControls.js'

interface Handlers {
  onChooseAlign: ReturnType<typeof vi.fn>
  onChooseChallenge: ReturnType<typeof vi.fn>
  onSkip: ReturnType<typeof vi.fn>
  onCloseSettings: ReturnType<typeof vi.fn>
}

const mountHarness = (
  ctx: { settingsOpen: boolean; choicesReady: boolean; isRevealing: boolean },
  handlers: Handlers
): { unmount: () => void; container: HTMLElement } => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const contextRef = ref(ctx)
  const Harness = defineComponent({
    setup() {
      useKeyboardControls(() => contextRef.value, handlers)
      return () => h('div')
    }
  })
  const app = createApp(Harness)
  app.mount(container)
  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    }
  }
}

const dispatch = (key: string, target: EventTarget = window): boolean => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true
  })
  return target.dispatchEvent(event)
}

describe('useKeyboardControls (DOM)', () => {
  const makeHandlers = (): Handlers => ({
    onChooseAlign: vi.fn(),
    onChooseChallenge: vi.fn(),
    onSkip: vi.fn(),
    onCloseSettings: vi.fn()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('dispatches choose-align on "1" when awaiting choice', () => {
    const handlers = makeHandlers()
    const h1 = mountHarness(
      { settingsOpen: false, choicesReady: true, isRevealing: false },
      handlers
    )
    dispatch('1')
    expect(handlers.onChooseAlign).toHaveBeenCalledTimes(1)
    expect(handlers.onChooseChallenge).not.toHaveBeenCalled()
    h1.unmount()
  })

  it('dispatches skip on Space / Enter while revealing', () => {
    const handlers = makeHandlers()
    const h1 = mountHarness(
      { settingsOpen: false, choicesReady: false, isRevealing: true },
      handlers
    )
    dispatch(' ')
    dispatch('Enter')
    expect(handlers.onSkip).toHaveBeenCalledTimes(2)
    h1.unmount()
  })

  it('dispatches close-settings on Escape when panel is open', () => {
    const handlers = makeHandlers()
    const h1 = mountHarness(
      { settingsOpen: true, choicesReady: true, isRevealing: true },
      handlers
    )
    dispatch('Escape')
    dispatch('1') // 应被忽略，面板打开优先
    expect(handlers.onCloseSettings).toHaveBeenCalledTimes(1)
    expect(handlers.onChooseAlign).not.toHaveBeenCalled()
    h1.unmount()
  })

  it('ignores input-target keys except Escape', () => {
    const handlers = makeHandlers()
    const h1 = mountHarness(
      { settingsOpen: true, choicesReady: true, isRevealing: true },
      handlers
    )
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const eventOne = new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true })
    input.dispatchEvent(eventOne)
    expect(handlers.onChooseAlign).not.toHaveBeenCalled()

    const eventEsc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(eventEsc)
    expect(handlers.onCloseSettings).toHaveBeenCalledTimes(1)

    h1.unmount()
  })

  it('prevents default for recognised keys only', () => {
    const handlers = makeHandlers()
    const h1 = mountHarness(
      { settingsOpen: false, choicesReady: true, isRevealing: false },
      handlers
    )
    const recognised = new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true })
    window.dispatchEvent(recognised)
    expect(recognised.defaultPrevented).toBe(true)

    const ignored = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true })
    window.dispatchEvent(ignored)
    expect(ignored.defaultPrevented).toBe(false)
    h1.unmount()
  })

  it('detaches the keydown listener after unmount', () => {
    const handlers = makeHandlers()
    const h1 = mountHarness(
      { settingsOpen: false, choicesReady: true, isRevealing: false },
      handlers
    )
    h1.unmount()
    dispatch('1')
    expect(handlers.onChooseAlign).not.toHaveBeenCalled()
  })
})
