import { test, expect } from '@playwright/test'

test('不正なJSONのインポートはエラー表示で状態を壊さない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerName', '保持される名前')
  await page.setInputFiles('#import-json', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"items": []}') })
  await expect(page.locator('#status')).toContainText('形式が不正')
  await expect(page.locator('#issuerName')).toHaveValue('保持される名前')
})

test('HTMLを含む入力が実行・解釈されない（XSS）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#recipientName', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('.doc-recipient')).toContainText('<img')
})

test('明細は最後の1行を削除できない／追加・削除できる', async ({ page }) => {
  await page.goto('/')
  await page.locator('.item-row button').first().click()
  await expect(page.locator('.item-row')).toHaveCount(1)
  await page.click('#add-item')
  await expect(page.locator('.item-row')).toHaveCount(2)
  await page.locator('.item-row button').first().click()
  await expect(page.locator('.item-row')).toHaveCount(1)
})

test('横スクロールが発生しない（スマホ/PC幅）', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  const row = page.locator('.item-row').first()
  await row.locator('[data-role=item-price]').fill('1000')
  await expect(page.locator('#grand-total')).toContainText('1,100円')
  await context.setOffline(false)
})

test('巨大な数値は上限エラーになり合計が壊れない', async ({ page }) => {
  await page.goto('/')
  const row = page.locator('.item-row').first()
  await row.locator('[data-role=item-qty]').fill('99999999999999999999')
  await expect(page.locator('#errors')).toContainText('以下の数値')
  await expect(page.locator('#grand-total')).toContainText('0円')
})
