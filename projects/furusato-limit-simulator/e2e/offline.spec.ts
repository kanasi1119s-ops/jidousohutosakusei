import { test, expect } from '@playwright/test'

test('Service Worker登録後、ネットワークを切っても再読み込みで動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // SWが制御下に入ってキャッシュを確立
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await page.fill('#salaryYen', '5000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit')).toHaveText('61,029円')
})
