import { expect, test } from '@playwright/test'

async function base(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.fill('#issuerName', '山田商店')
  await page.fill('#issuerReg', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#invClient', 'テスト株式会社')
  await page.fill('[data-k="description"][data-i="0"]', '作業')
}

test('全角の数量・単価・登録番号が正しく処理される', async ({ page }) => {
  await base(page)
  await page.fill('[data-k="quantity"][data-i="0"]', '２．５')
  await page.fill('[data-k="unitPrice"][data-i="0"]', '４，０００')
  await expect(page.locator('#paper')).toContainText('ご請求金額（税込）: ¥11,000')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toBeEmpty()
  await expect(page.locator('#paper')).toContainText('登録番号: T1234567890123')
})

test('巨大金額は保存できずエラーになる', async ({ page }) => {
  await base(page)
  await page.fill('[data-k="unitPrice"][data-i="0"]', '1000000000000000')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toContainText('金額が大きすぎます')
})

test('数量0・不正な数値はエラー', async ({ page }) => {
  await base(page)
  await page.fill('[data-k="quantity"][data-i="0"]', '0')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toContainText('数量')
  await page.fill('[data-k="quantity"][data-i="0"]', 'abc')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toContainText('数量')
})

test('支払期限が発行日より前だと警告される', async ({ page }) => {
  await base(page)
  await page.fill('#invDate', '2026-11-24')
  await page.fill('#invDue', '2026-11-01')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toContainText('支払期限')
})

test('明細を全削除してもクラッシュせず、追加で復帰できる', async ({ page }) => {
  await base(page)
  await page.click('[data-del="0"]')
  await expect(page.locator('#paper')).toContainText('¥0')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toContainText('明細を1行以上')
  await page.click('#add-item')
  await expect(page.locator('[data-k="description"]')).toHaveCount(1)
})

test('多数の明細（100行）でも合計が正しい', async ({ page }) => {
  await base(page)
  await page.fill('[data-k="unitPrice"][data-i="0"]', '100')
  for (let i = 1; i < 100; i++) await page.click('#add-item')
  for (let i = 1; i < 100; i++) await page.fill(`[data-k="unitPrice"][data-i="${i}"]`, '100')
  await expect(page.locator('#paper')).toContainText('ご請求金額（税込）: ¥11,000')
})

test('CSVの数式インジェクション文字列が無害化される', async ({ page }) => {
  await base(page)
  await page.fill('[data-k="description"][data-i="0"]', '=HYPERLINK("http://x")')
  await page.fill('[data-k="unitPrice"][data-i="0"]', '100')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  const text = (await import('node:fs')).readFileSync(await dl.path(), 'utf8')
  expect(text).toContain(`"'=HYPERLINK(""http://x"")"`)
})

test('保存済みの請求書を削除できる', async ({ page }) => {
  await base(page)
  await page.fill('[data-k="unitPrice"][data-i="0"]', '100')
  await page.click('#save-inv')
  await page.click('[data-remove]')
  await expect(page.locator('#saved-list')).toContainText('保存済みの請求書はありません')
})

test('壊れたlocalStorageがあっても起動する', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('invoice-generator:data:v1', '{broken'))
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
})
