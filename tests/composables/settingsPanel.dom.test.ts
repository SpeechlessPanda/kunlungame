// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import SettingsPanel from '../../src/renderer/components/SettingsPanel.vue'
import {
  getDefaultModelProfile,
  getFallbackModelProfile,
  getProModelProfile
} from '../../src/modeling/modelProfiles.js'

const defaultBgm = {
  enabled: true,
  volume: 0.5,
  sourceAvailable: true
}

interface MountResult {
  container: HTMLElement
  unmount: () => void
  emitted: {
    setModelMode: Array<'default' | 'compatibility' | 'pro'>
    close: number
    toggleBgm: number
    setVolume: number[]
    downloadProfile: string[]
  }
}

const mountSettings = (
  preferredModelMode: 'default' | 'compatibility' | 'pro',
  selectedProfileId: string | null,
  extraProps: Record<string, unknown> = {}
): MountResult => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const emitted: MountResult['emitted'] = {
    setModelMode: [],
    close: 0,
    toggleBgm: 0,
    setVolume: [],
    downloadProfile: []
  }

  const app = createApp({
    render() {
      return h(SettingsPanel, {
        open: true,
        bgm: defaultBgm,
        preferredModelMode,
        selectedProfileId,
        ...extraProps,
        onClose: () => {
          emitted.close += 1
        },
        'onToggle-bgm': () => {
          emitted.toggleBgm += 1
        },
        'onSet-volume': (v: number) => {
          emitted.setVolume.push(v)
        },
        'onSet-model-mode': (mode: 'default' | 'compatibility' | 'pro') => {
          emitted.setModelMode.push(mode)
        },
        'onDownload-profile': (profileId: string) => {
          emitted.downloadProfile.push(profileId)
        }
      })
    }
  })

  app.mount(container)

  return {
    container,
    emitted,
    unmount: () => {
      app.unmount()
      container.remove()
    }
  }
}

describe('SettingsPanel · model profile picker', () => {
  let mounted: MountResult | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    mounted?.unmount()
    mounted = null
    vi.useRealTimers()
  })

  it('renders three profile options reflecting the current preferred mode', () => {
    mounted = mountSettings('default', getDefaultModelProfile().id)

    const radios = mounted.container.querySelectorAll('[role="radio"]')
    expect(radios.length).toBe(3)

    const defaultOption = mounted.container.querySelector('[data-testid="settings-model-default"]')
    const liteOption = mounted.container.querySelector('[data-testid="settings-model-compatibility"]')
    const proOption = mounted.container.querySelector('[data-testid="settings-model-pro"]')

    expect(defaultOption?.getAttribute('aria-checked')).toBe('true')
    expect(liteOption?.getAttribute('aria-checked')).toBe('false')
    expect(proOption?.getAttribute('aria-checked')).toBe('false')

    // 当前加载的档位（= default 时）应该显示"当前加载"徽标，在该 option 内部。
    const activePill = defaultOption?.querySelector('[data-testid="settings-model-active-pill"]')
    expect(activePill).not.toBeNull()
  })

  it('emits set-model-mode when user picks a different profile and suppresses re-emit on the active one', () => {
    mounted = mountSettings('default', getDefaultModelProfile().id)

    const liteOption = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-model-compatibility"]'
    )
    const proOption = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-model-pro"]'
    )
    const defaultOption = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-model-default"]'
    )

    liteOption?.click()
    proOption?.click()
    // 点击当前已选中档位不应再触发 emit。
    defaultOption?.click()

    expect(mounted.emitted.setModelMode).toEqual(['compatibility', 'pro'])
  })

  it('labels all three profile ids consistently with modelProfiles module', () => {
    mounted = mountSettings('pro', getProModelProfile().id)

    const liteOption = mounted.container.querySelector('[data-testid="settings-model-compatibility"]')
    expect(liteOption?.textContent ?? '').toContain('Lite Mode')

    const proOption = mounted.container.querySelector('[data-testid="settings-model-pro"]')
    expect(proOption?.getAttribute('aria-checked')).toBe('true')
    expect(proOption?.textContent ?? '').toContain('Pro Mode')

    // 默认 / lite 在这次 mount 中均未加载，不应出现"当前加载"徽标。
    const defaultOption = mounted.container.querySelector('[data-testid="settings-model-default"]')
    expect(defaultOption?.querySelector('[data-testid="settings-model-active-pill"]')).toBeNull()
    // fallback profile id 与 modelProfiles 保持一致校验。
    expect(getFallbackModelProfile().id).toBe('qwen2.5-1.5b-instruct-q4km')
  })

  it('shows the download CTA for a profile whose availability is missing', () => {
    mounted = mountSettings('default', getDefaultModelProfile().id, {
      profileAvailability: {
        [getDefaultModelProfile().id]: 'ready',
        [getFallbackModelProfile().id]: 'ready',
        [getProModelProfile().id]: 'missing'
      }
    })

    const proDownload = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-model-download-pro"]'
    )
    expect(proDownload).not.toBeNull()
    // ready 档位不应该出现下载按钮。
    const defaultDownload = mounted.container.querySelector(
      '[data-testid="settings-model-download-default"]'
    )
    expect(defaultDownload).toBeNull()

    proDownload?.click()
    expect(mounted.emitted.downloadProfile).toEqual([getProModelProfile().id])
    // 点击下载按钮不应被父级 radio onclick 当成切档位事件触发。
    expect(mounted.emitted.setModelMode).toEqual([])
  })

  it('renders the progress line while a download is in flight and hides the CTA', () => {
    mounted = mountSettings('pro', getDefaultModelProfile().id, {
      profileAvailability: {
        [getProModelProfile().id]: 'missing'
      },
      downloadStatus: {
        profileId: getProModelProfile().id,
        phase: 'downloading',
        fileIndex: 1,
        totalFiles: 2,
        message: '下载第 1 个分片'
      }
    })

    const progress = mounted.container.querySelector(
      '[data-testid="settings-model-progress-pro"]'
    )
    expect(progress).not.toBeNull()
    expect(progress?.textContent ?? '').toContain('(1/2)')
    expect(progress?.textContent ?? '').toContain('下载第 1 个分片')

    // 下载中不应再显示 "下载权重" CTA。
    const proDownload = mounted.container.querySelector(
      '[data-testid="settings-model-download-pro"]'
    )
    expect(proDownload).toBeNull()
  })
})
