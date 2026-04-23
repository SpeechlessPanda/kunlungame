import { expect, test } from '@playwright/test'

test('renderer shell mounts the placeholder desktop shell page', async ({ page }) => {
  await page.goto('/src/renderer/index.html')

  await expect(page.getByRole('heading', { name: 'Kunlungame Desktop Shell' })).toBeVisible()
  await expect(page.getByText('基础桌面壳已挂载')).toBeVisible()
})