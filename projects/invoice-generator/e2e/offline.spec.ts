import { test, expect } from '@playwright/test'

test('一度開けばネットワークを切ってもコア機能が動く', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // Service Worker 制御下に入れる
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書ジェネレーター')
  await page.fill('#clientName', 'オフライン商事')
  await expect(page.locator('#preview')).toBeVisible()
  await context.setOffline(false)
})
