import { test, expect } from '@playwright/test'

test('巨大な金額はエラーになり、印刷・CSV・保存は実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerName', 'テスト')
  await page.fill('#customerName', '宛名')
  await page.locator('.it-name').first().fill('品')
  await page.locator('.it-qty').first().fill('99999999999')
  await page.locator('.it-price').first().fill('99999999999')
  await expect(page.locator('#errors')).toContainText('大きすぎ')
  await page.locator('#save-invoice').evaluate((e) => (e as HTMLElement).click())
  await expect(page.locator('#saved-list li')).toContainText('まだ保存した請求書はありません')
})

test('不正な数値（文字・空）はエラー表示でクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.locator('.it-qty').first().fill('あいう')
  await page.locator('.it-price').first().fill('')
  await expect(page.locator('#errors')).toContainText('数量')
  await expect(page.locator('#errors')).toContainText('単価')
  await expect(page.locator('#preview h2')).toHaveText('請求書')
})

test('最後の明細を削除しても空行が残る / 二重クリックで明細が増える', async ({ page }) => {
  await page.goto('/')
  await page.locator('.it-del').first().click()
  await expect(page.locator('#items .item')).toHaveCount(1)
  await page.locator('#add-item').click()
  await page.locator('#add-item').click()
  await expect(page.locator('#items .item')).toHaveCount(3)
})

test('壊れたlocalStorageがあっても初期状態で起動する', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('invoice-maker:state:v1', '{broken'))
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書メーカー')
})

test('登録番号の形式エラーを表示する', async ({ page }) => {
  await page.goto('/')
  await page.fill('#registrationNumber', 'T12')
  await expect(page.locator('#errors')).toContainText('13桁')
})

test('税込入力・四捨五入の切替で合計が変わる', async ({ page }) => {
  await page.goto('/')
  await page.locator('.it-name').first().fill('品')
  await page.locator('.it-price').first().fill('1000')
  await page.selectOption('#priceMode', 'incl')
  await expect(page.locator('#grand-total')).toContainText('¥1,000')
  await page.selectOption('#priceMode', 'excl')
  await expect(page.locator('#grand-total')).toContainText('¥1,100')
})

test('印刷用CSSで入力フォームが非表示になる', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#form-col')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('PC幅(1280px)で2カラム表示', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const a = await page.locator('#form-col').boundingBox()
  const b = await page.locator('#preview').boundingBox()
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 5)
})
