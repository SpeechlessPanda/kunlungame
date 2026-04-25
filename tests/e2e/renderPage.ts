import type { Page } from '@playwright/test'

export const gotoRenderer = async (page: Page): Promise<void> => {
  await page.goto('/src/renderer/index.html', { waitUntil: 'domcontentloaded' })
}