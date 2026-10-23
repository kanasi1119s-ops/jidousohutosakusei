import { test, expect } from '@playwright/test'

test('空欄のまま送信してもクラッシュせずエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales8Yen', '')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('課税売上高（8%）')
})

test('巨大な入力値は上限エラーになり、上限内ならクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '99999999999999')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('以下')
  await page.fill('#sales10Yen', '4999999999')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '7777000')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#sales10Yen')).toHaveValue('7777000')
})

test('還付になる入力では本則課税が推奨され合計がマイナス表示になる', async ({ page }) => {
  await page.goto('/')
  await page.uncheck('#wasExempt')
  await page.fill('#purchases10Yen', '11000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#best-method')).toContainText('還付')
  await expect(page.locator('#result-body tr.best')).toContainText('本則課税')
})

test('PC幅(1280px)でもスマホ幅(375px)でも横スクロールが発生しない', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow).toBe(false)
  }
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス特例 納税額比較')
  await page.fill('#sales10Yen', '2000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#best-method')).toContainText('最も納税額が少ない方式')
  await context.setOffline(false)
})
