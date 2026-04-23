import { describe, expect, it } from 'vitest'
import {
  createBgmController,
  DEFAULT_BGM_VOLUME,
  isAudible
} from '../src/presentation/bgmController.js'

describe('bgmController', () => {
  it('defaults to enabled with default volume and no source', () => {
    const controller = createBgmController()
    const state = controller.snapshot()
    expect(state.enabled).toBe(true)
    expect(state.volume).toBe(DEFAULT_BGM_VOLUME)
    expect(state.sourceAvailable).toBe(false)
    expect(isAudible(state)).toBe(false)
  })

  it('becomes audible only when enabled + source present + volume > 0', () => {
    const controller = createBgmController()
    controller.markSourceAvailable(true)
    controller.enable()
    const state = controller.setVolume(0.8)
    expect(isAudible(state)).toBe(true)
  })

  it('disables itself when source disappears', () => {
    const controller = createBgmController({ enabled: true, sourceAvailable: true })
    const state = controller.markSourceAvailable(false)
    expect(state.sourceAvailable).toBe(false)
    expect(state.enabled).toBe(false)
    expect(isAudible(state)).toBe(false)
  })

  it('toggles enable flag', () => {
    const controller = createBgmController({ enabled: false })
    expect(controller.toggle().enabled).toBe(true)
    expect(controller.toggle().enabled).toBe(false)
  })

  it('clamps volume between 0 and 1', () => {
    const controller = createBgmController()
    expect(controller.setVolume(-1).volume).toBe(0)
    expect(controller.setVolume(2).volume).toBe(1)
    expect(controller.setVolume(Number.NaN).volume).toBe(0)
  })
})
