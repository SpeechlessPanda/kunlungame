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
      ;(window as unknown as { __kunlunDebug: { injectError(m: string): void } }).__kunlunDebug.injectError(
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
})
