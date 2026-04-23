import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/**
 * 可爱风 UI 目视审阅：跑一遍核心界面并截图到 test-results/ui-review/。
 * 这组用例不做视觉 diff 断言（我们没有 snapshot baseline），
 * 仅保证每一步能正常到达、关键 testid 可见，然后把图片 dump 出来给人眼审。
 */

const outDir = path.resolve(process.cwd(), 'test-results', 'ui-review')

test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true })
})

test.describe('UI review screenshots · galgame 可爱风', () => {
    test('empty → dialog streaming → choices → ending loop', async ({ page }) => {
        await page.goto('/src/renderer/index.html')

        // 1) 空态（首次进入）
        await expect(page.getByTestId('dialog-empty')).toBeVisible()
        await page.screenshot({
            path: path.join(outDir, '01-empty.png'),
            fullPage: true
        })

        // 2) 开始第一轮
        await page.getByTestId('start-button').click()
        // 等待对话骨架或文字出现
        await page.waitForFunction(() => {
            const textEl = document.querySelector('[data-testid="dialog-text"]')
            const stateEl = document.querySelector('[data-testid="dialog-state"]')
            return textEl != null || (stateEl?.textContent ?? '').length > 0
        }, undefined, { timeout: 15_000 })
        await page.screenshot({
            path: path.join(outDir, '02-streaming.png'),
            fullPage: true
        })

        // 3) 等待选项出现
        const skipBtn = page.getByTestId('dialog-skip')
        if (await skipBtn.isVisible().catch(() => false)) {
            await skipBtn.click()
        }
        await expect(page.getByTestId('choice-align')).toBeVisible({ timeout: 15_000 })
        await page.screenshot({
            path: path.join(outDir, '03-choices.png'),
            fullPage: true
        })

        // 4) 选一个选项，截下一轮
        await page.getByTestId('choice-align').click()
        await page.waitForTimeout(600)
        await page.screenshot({
            path: path.join(outDir, '04-next-turn.png'),
            fullPage: true
        })
    })

    test('settings panel open state', async ({ page }) => {
        await page.goto('/src/renderer/index.html')
        const settingsBtn = page.getByRole('button', { name: /设置/ }).first()
        if (await settingsBtn.isVisible().catch(() => false)) {
            await settingsBtn.click()
            await page.waitForTimeout(300)
            await page.screenshot({
                path: path.join(outDir, '05-settings.png'),
                fullPage: true
            })
        }
    })
})
