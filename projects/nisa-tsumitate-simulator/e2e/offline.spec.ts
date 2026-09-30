import { test, expect } from '@playwright/test'

test('オフラインでも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await page.click('button[type="submit"]')
  await expect(page.locator('#totals')).toContainText('最終評価額')
  await context.setOffline(false)
})
