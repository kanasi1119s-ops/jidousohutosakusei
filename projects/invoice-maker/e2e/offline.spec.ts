import { test, expect } from '@playwright/test'

test('一度開けばオフラインでも再読み込みして使える', async ({ page, context, browserName }, info) => {
  test.skip(info.project.name !== 'chromium', 'Service Worker検証はデスクトップ1環境で十分')
  void browserName
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // SWの制御下に入る
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await page.click('#btn-new')
  await expect(page.locator('#editor')).toBeVisible()
})
