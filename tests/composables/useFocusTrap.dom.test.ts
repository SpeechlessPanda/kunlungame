// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type Ref } from 'vue'
import {
  collectFocusable,
  useFocusTrap
} from '../../src/renderer/composables/useFocusTrap.js'

interface HarnessHandle {
  active: Ref<boolean>
  panel: Ref<HTMLElement | null>
  entry: HTMLButtonElement
  unmount: () => void
}

const mountHarness = (initialActive = false): HarnessHandle => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const entry = document.createElement('button')
  entry.type = 'button'
  entry.textContent = 'entry'
  entry.dataset['testid'] = 'entry'
  document.body.appendChild(entry)

  const active = ref(initialActive)
  const panel = ref<HTMLElement | null>(null)

  const Harness = defineComponent({
    setup() {
      useFocusTrap(active, panel)
      return () =>
        h(
          'div',
          {
            ref: (el: unknown) => {
              panel.value = (el as HTMLElement | null) ?? null
            },
            'data-testid': 'panel'
          },
          [
            h('button', { type: 'button', 'data-testid': 'first' }, 'first'),
            h('button', { type: 'button', 'data-testid': 'second' }, 'second'),
            h('button', { type: 'button', 'data-testid': 'third' }, 'third')
          ]
        )
    }
  })

  const app = createApp(Harness)
  app.mount(container)

  return {
    active,
    panel,
    entry,
    unmount: () => {
      app.unmount()
      container.remove()
      entry.remove()
    }
  }
}

const tab = (shift = false): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: shift,
    bubbles: true,
    cancelable: true
  })
  document.dispatchEvent(event)
  return event
}

describe('collectFocusable', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns buttons, inputs, selects, and elements with tabindex ≥ 0', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <button data-id="a">A</button>
      <button data-id="b" disabled>B</button>
      <input data-id="c" />
      <select data-id="d"><option>1</option></select>
      <a href="#" data-id="e">link</a>
      <div tabindex="0" data-id="f">focusable div</div>
      <div tabindex="-1" data-id="g">unreachable</div>
      <span data-id="h">plain</span>
    `
    document.body.appendChild(root)
    const ids = collectFocusable(root).map((el) => el.getAttribute('data-id'))
    expect(ids).toEqual(['a', 'c', 'd', 'e', 'f'])
  })

  it('skips elements that are aria-hidden', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <button data-id="visible">ok</button>
      <button data-id="hidden" aria-hidden="true">hidden</button>
    `
    document.body.appendChild(root)
    const ids = collectFocusable(root).map((el) => el.getAttribute('data-id'))
    expect(ids).toEqual(['visible'])
  })
})

describe('useFocusTrap (DOM)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('focuses the first focusable element when activated', async () => {
    const h1 = mountHarness(false)
    h1.entry.focus()
    expect(document.activeElement).toBe(h1.entry)

    h1.active.value = true
    await nextTick()
    await nextTick()

    const first = document.querySelector('[data-testid="first"]') as HTMLElement
    expect(document.activeElement).toBe(first)
    h1.unmount()
  })

  it('cycles focus forward and wraps at the last element', async () => {
    const h1 = mountHarness(true)
    await nextTick()
    await nextTick()

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-testid="panel"] button')
    )
    buttons[0]!.focus()

    const e1 = tab(false)
    expect(e1.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[1])

    tab(false)
    expect(document.activeElement).toBe(buttons[2])

    tab(false) // 回到第一个
    expect(document.activeElement).toBe(buttons[0])
    h1.unmount()
  })

  it('cycles focus backward with Shift+Tab and wraps at the first element', async () => {
    const h1 = mountHarness(true)
    await nextTick()
    await nextTick()

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-testid="panel"] button')
    )
    buttons[0]!.focus()

    tab(true)
    expect(document.activeElement).toBe(buttons[buttons.length - 1])

    tab(true)
    expect(document.activeElement).toBe(buttons[buttons.length - 2])
    h1.unmount()
  })

  it('restores focus to the previously focused element on deactivation', async () => {
    const h1 = mountHarness(false)
    h1.entry.focus()
    expect(document.activeElement).toBe(h1.entry)

    h1.active.value = true
    await nextTick()
    await nextTick()
    expect(document.activeElement).not.toBe(h1.entry)

    h1.active.value = false
    await nextTick()
    expect(document.activeElement).toBe(h1.entry)
    h1.unmount()
  })

  it('ignores Tab events when inactive', async () => {
    const h1 = mountHarness(false)
    await nextTick()
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-testid="panel"] button')
    )
    buttons[0]!.focus()
    const event = tab(false)
    // 未激活时不拦截默认行为
    expect(event.defaultPrevented).toBe(false)
    h1.unmount()
  })
})
