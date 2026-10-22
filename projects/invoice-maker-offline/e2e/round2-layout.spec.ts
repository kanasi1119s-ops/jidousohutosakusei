import { expect, test } from '@playwright/test'

test('明細の入力欄がスマホ幅でも操作できる幅を持つ', async ({ page }) => {
  await page.goto('/')
  const qty = await page.locator('.li-qty').first().boundingBox()
  const price = await page.locator('.li-price').first().boundingBox()
  expect(qty?.width ?? 0).toBeGreaterThanOrEqual(60)
  expect(price?.width ?? 0).toBeGreaterThanOrEqual(90)
})

test('バックアップ読み込みラベルが縦に割れない', async ({ page }) => {
  await page.goto('/')
  const box = await page.locator('label.check:has(#import-json)').boundingBox()
  expect(box?.height ?? 999).toBeLessThan(90)
})
