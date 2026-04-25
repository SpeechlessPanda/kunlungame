import { expect, test } from '@playwright/test'
import { gotoRenderer } from './renderPage.js'

test.describe('Kunlun Ballad UI shell', () => {
  test('renders the game shell with status bar, dialogue and start entry', async ({ page }) => {
    await gotoRenderer(page)

    await expect(page.getByTestId('game-shell')).toBeVisible()
    await expect(page.getByTestId('status-node-title')).toContainText('昆仑初问')
    await expect(page.getByTestId('dialog-empty')).toBeVisible()
    await expect(page.getByTestId('start-button')).toBeVisible()
  })

  test('streams dialogue text after pressing start and enables choice buttons', async ({ page }) => {
    await gotoRenderer(page)
    await page.getByTestId('start-button').click()

    await expect(page.getByTestId('dialog-text')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('dialog-text')).toContainText('昆仑', { timeout: 8000 })

    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('choice-challenge')).toBeVisible()
  })

  test('changes node when advancing via the align choice', async ({ page }) => {
    await gotoRenderer(page)
    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15000 })

    // 2026-04-25 重构：kunlun-threshold.minTurns 回调到 1，
    // 一次 align 点击应该直接推进到 creation-myths。
    await page.getByTestId('choice-align').click()
    // canonical mainline: kunlun-threshold (fictional) → creation-myths (fictional)
    await expect(page.getByTestId('status-node-title')).toContainText('神话开天', { timeout: 15000 })
    await expect(page.getByTestId('background-mode-label')).toHaveText('虚构意象')
  })

  test('shows error state with retry entry when injected', async ({ page }) => {
    await gotoRenderer(page)
    await page.getByTestId('start-button').click()
    await page.waitForFunction(
      () =>
        (window as unknown as { __kunlunDebug?: { snapshot(): { state: string } } }).__kunlunDebug?.snapshot()
          .state === 'streaming',
      undefined,
      { timeout: 5000 }
    )
    await page.evaluate(() => {
      ; (window as unknown as { __kunlunDebug: { injectError(m: string): void } }).__kunlunDebug.injectError(
        '模型暂时不可用，请稍后重试。'
      )
    })

    await expect(page.getByTestId('dialog-error')).toBeVisible()
    await expect(page.getByTestId('dialog-retry')).toBeVisible()
    await expect(page.getByTestId('dialog-error')).toContainText('模型暂时不可用')
  })

  test('settings panel exposes a BGM toggle that stays safe without source', async ({ page }) => {
    await gotoRenderer(page)
    await page.getByTestId('settings-open').click()
    const toggle = page.getByTestId('settings-bgm-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeDisabled()
    await page.getByTestId('settings-close').click()
  })

  test('keyboard shortcut 1 picks the align option when choices are ready', async ({ page }) => {
    await gotoRenderer(page)
    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15000 })

    // 2026-04-25 重构：minTurns = 1，一次快捷键即可推进到下一节点。
    await page.keyboard.press('1')
    await expect(page.getByTestId('status-node-title')).toContainText('神话开天', { timeout: 15000 })
  })

  test('Escape closes the settings panel and restores focus to the entry button', async ({ page }) => {
    await gotoRenderer(page)
    const entry = page.getByTestId('settings-open')
    await entry.focus()
    await entry.press('Enter')
    await expect(page.getByTestId('settings-overlay')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings-overlay')).toHaveCount(0)
    // 焦点还给设置入口按钮
    await expect(entry).toBeFocused()
  })

  test('mobile viewport keeps dialog and tap-friendly choices (≥56px)', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 })
    await gotoRenderer(page)
    await expect(page.getByTestId('game-shell')).toBeVisible()
    await expect(page.getByTestId('dialog-empty')).toBeVisible()

    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15000 })

    const alignBox = await page.getByTestId('choice-align').boundingBox()
    const challengeBox = await page.getByTestId('choice-challenge').boundingBox()
    expect(alignBox?.height ?? 0).toBeGreaterThanOrEqual(56)
    expect(challengeBox?.height ?? 0).toBeGreaterThanOrEqual(56)
  })

  test('visual regression: mobile status bar stacks and choice buttons go single column', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 })
    await gotoRenderer(page)

    const statusBar = page.locator('.status-bar')
    const statusFlex = await statusBar.evaluate((el) => getComputedStyle(el).flexDirection)
    expect(statusFlex).toBe('column')

    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15000 })
    const gridTemplate = await page
      .locator('.choice-panel__buttons')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    // 单列时 grid-template-columns 只剩一个轨道（例如 "360px"）
    expect(gridTemplate.trim().split(/\s+/).length).toBe(1)
  })

  test('visual regression: desktop layout keeps status bar in row and choices two-column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await gotoRenderer(page)

    const statusBar = page.locator('.status-bar')
    const statusFlex = await statusBar.evaluate((el) => getComputedStyle(el).flexDirection)
    expect(statusFlex).toBe('row')

    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15000 })
    const tracks = await page
      .locator('.choice-panel__buttons')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length)
    expect(tracks).toBe(2)
  })

  test('reduced-motion: blinking cursor animation is disabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoRenderer(page)
    await page.getByTestId('start-button').click()

    // 等流式开始但还没揭示完
    await expect(page.getByTestId('dialog-text')).toBeVisible({ timeout: 5000 })
    const cursor = page.locator('.dialog-panel__cursor').first()
    if ((await cursor.count()) > 0) {
      const animation = await cursor.evaluate((el) => getComputedStyle(el).animationName)
      expect(animation).toBe('none')
    }
  })

  test('performance: shell first paint and first dialogue chunk land under budgets', async ({ page }) => {
    const t0 = Date.now()
    await gotoRenderer(page)
    await page.getByTestId('game-shell').waitFor({ state: 'visible', timeout: 5000 })
    const shellMs = Date.now() - t0

    // 对 Vite dev 环境设一个宽松但有效的预算：5000ms 内壳可见。
    expect(shellMs).toBeLessThan(5000)

    const t1 = Date.now()
    await page.getByTestId('start-button').click()
    await page.getByTestId('dialog-text').waitFor({ state: 'visible', timeout: 5000 })
    const firstChunkMs = Date.now() - t1
    // 首段讲述 chunk（320ms 延迟 + 揭示）通常 < 2000ms。
    expect(firstChunkMs).toBeLessThan(4000)

    // 记录到 stdout，便于 CI 看到演进。
    // eslint-disable-next-line no-console
    console.log(`[perf] shell-visible=${shellMs}ms first-chunk=${firstChunkMs}ms`)
  })
})
