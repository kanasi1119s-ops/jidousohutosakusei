import { expect, test } from '@playwright/test'

test('一度開けばオフラインでも動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload() // SW 制御下にする
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '請求書メーカー（インボイス対応）' })).toBeVisible()
  await page.fill('[data-row="0"] [data-f="unitPrice"]', '1000')
  await expect(page.locator('#grand-total')).toHaveText('1,100円')
})
