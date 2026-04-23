import { expect, test } from '@playwright/test'

test.describe('Kunlun Ballad UI shell', () => {
  test('renders the game shell with status bar, dialogue and start entry', async ({ page }) => {
    await page.goto('/src/renderer/index.html')

    await expect(page.getByTestId('game-shell')).toBeVisible()
    await expect(page.getByTestId('status-node-title')).toContainText('昆仑开篇')
    await expect(page.getByTestId('dialog-empty')).toBeVisible()
    await expect(page.getByTestId('start-button')).toBeVisible()
  })

  test('streams dialogue text after pressing start and enables choice buttons', async ({ page }) => {
    await page.goto('/src/renderer/index.html')
    await page.getByTestId('start-button').click()

    await expect(page.getByTestId('dialog-text')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('dialog-text')).toContainText('云海', { timeout: 8000 })

    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('choice-challenge')).toBeVisible()
  })

  test('changes background mode when advancing to next node', async ({ page }) => {
    await page.goto('/src/renderer/index.html')
    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('choice-align').click()
    await expect(page.getByTestId('status-node-title')).toContainText('礼乐之径', { timeout: 5000 })
    await expect(page.getByTestId('background-mode-label')).toHaveText('实景照片')
  })

  test('shows error state with retry entry when injected', async ({ page }) => {
    await page.goto('/src/renderer/index.html')
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
    await page.goto('/src/renderer/index.html')
    await page.getByTestId('settings-open').click()
    const toggle = page.getByTestId('settings-bgm-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeDisabled()
    await page.getByTestId('settings-close').click()
  })

  test('keyboard shortcut 1 picks the align option when choices are ready', async ({ page }) => {
    await page.goto('/src/renderer/index.html')
    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('1')
    await expect(page.getByTestId('status-node-title')).toContainText('礼乐之径', { timeout: 5000 })
  })

  test('Escape closes the settings panel and restores focus to the entry button', async ({ page }) => {
    await page.goto('/src/renderer/index.html')
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
    await page.goto('/src/renderer/index.html')
    await expect(page.getByTestId('game-shell')).toBeVisible()
    await expect(page.getByTestId('dialog-empty')).toBeVisible()

    await page.getByTestId('start-button').click()
    await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 10000 })

    const alignBox = await page.getByTestId('choice-align').boundingBox()
    const challengeBox = await page.getByTestId('choice-challenge').boundingBox()
    expect(alignBox?.height ?? 0).toBeGreaterThanOrEqual(56)
    expect(challengeBox?.height ?? 0).toBeGreaterThanOrEqual(56)
  })
})
