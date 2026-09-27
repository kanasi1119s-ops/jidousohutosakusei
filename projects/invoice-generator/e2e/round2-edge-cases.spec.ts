import { test, expect } from '@playwright/test'

test('品目名が空のまま保存しようとするとエラーになり保存されない', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', 'テスト取引先')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
  await page.click('#invoice-form button[type="submit"]')
  await expect(page.locator('#invoice-errors')).toContainText('品目名')
  await expect(page.locator('#panel-invoice')).toHaveClass(/active/)
})

test('数量が0以下だとエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', 'テスト取引先')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="name"][data-index="0"]', '商品')
  await page.fill('[data-field="quantity"][data-index="0"]', '0')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
  await page.click('#invoice-form button[type="submit"]')
  await expect(page.locator('#invoice-errors')).toContainText('数量')
})

test('登録番号の形式が不正だと事業者情報の保存が止まる', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="profile"]')
  await page.fill('#businessName', 'テスト商店')
  await page.fill('#registrationNumber', '不正な番号')
  await page.click('#profile-form button[type="submit"]')
  await expect(page.locator('#profile-errors')).toContainText('登録番号')
})

test('品目の追加・削除ボタンを連打しても行数が正しく保たれる', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.click('#add-item-row')
  await page.click('#add-item-row')
  await page.click('#add-item-row')
  await expect(page.locator('.item-row')).toHaveCount(4)

  await page.click('[data-remove-row="3"]')
  await page.click('[data-remove-row="2"]')
  await expect(page.locator('.item-row')).toHaveCount(2)
})

test('取引先名・住所に記号や引用符を含む日本語文字列を入れてもXSSにならず正しく表示される', async ({
  page,
}) => {
  await page.goto('/')
  await page.click('button[data-tab="clients"]')
  const dangerousName = '<script>alert(1)</script>株式会社"引用符"&記号'
  await page.fill('#clientName', dangerousName)
  await page.fill('#clientAddress', '東京都<b>テスト</b>区')
  await page.click('#client-form button[type="submit"]')

  await expect(page.locator('#clients-body')).toContainText(dangerousName)
  const scriptCount = await page.locator('#clients-body script').count()
  expect(scriptCount).toBe(0)
})

test('保存された請求書履歴・取引先・事業者情報はリロード後もIndexedDBから復元される', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="clients"]')
  await page.fill('#clientName', '永続化確認商店')
  await page.click('#client-form button[type="submit"]')

  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', '永続化確認商店')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="name"][data-index="0"]', '商品')
  await page.fill('[data-field="quantity"][data-index="0"]', '1')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
  await page.click('#invoice-form button[type="submit"]')
  await expect(page.locator('#invoices-body')).toContainText('永続化確認商店')

  await page.reload()
  await expect(page.locator('#invoices-body')).toContainText('永続化確認商店')
  await page.click('button[data-tab="clients"]')
  await expect(page.locator('#clients-body')).toContainText('永続化確認商店')
})

test('請求書の複製で新しい発行日のまま品目が引き継がれる', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', '複製元取引先')
  await page.fill('#issueDate', '2026-01-01')
  await page.fill('[data-field="name"][data-index="0"]', '複製対象品目')
  await page.fill('[data-field="quantity"][data-index="0"]', '2')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '3000')
  await page.click('#invoice-form button[type="submit"]')

  await page.click('[data-duplicate]')
  await expect(page.locator('#panel-invoice')).toHaveClass(/active/)
  await expect(page.locator('[data-field="name"][data-index="0"]')).toHaveValue('複製対象品目')
  await expect(page.locator('#issueDate')).not.toHaveValue('2026-01-01')
})

test('請求書を削除すると履歴から消える', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', '削除確認取引先')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="name"][data-index="0"]', '商品')
  await page.fill('[data-field="quantity"][data-index="0"]', '1')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
  await page.click('#invoice-form button[type="submit"]')

  await expect(page.locator('#invoices-body tr')).toHaveCount(1)
  await page.click('[data-delete-invoice]')
  await expect(page.locator('#invoices-body tr')).toHaveCount(0)
})

test('PC幅(1280px)でもレイアウトが崩れない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalScroll).toBe(false)
})

test('オフライン（ネットワーク切断）でも請求書の作成・保存ができる', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })

  await context.setOffline(true)
  await page.reload()

  await expect(page.locator('h1')).toHaveText('適格請求書ジェネレーター')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', 'オフライン取引先')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="name"][data-index="0"]', '商品')
  await page.fill('[data-field="quantity"][data-index="0"]', '1')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
  await page.click('#invoice-form button[type="submit"]')
  await expect(page.locator('#invoices-body')).toContainText('オフライン取引先')

  await context.setOffline(false)
})
