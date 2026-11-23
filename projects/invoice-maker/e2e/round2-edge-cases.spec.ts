import { test, expect } from '@playwright/test'

async function start(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.click('#btn-new')
  await page.fill('#inv-customer', 'テスト')
  await page.fill('.in-name >> nth=0', '品')
}

test('巨大な金額でも表示が壊れない（Infinityにならない）', async ({ page }) => {
  await start(page)
  await page.fill('.in-qty >> nth=0', '1e308')
  await page.fill('.in-price >> nth=0', '1e308')
  await expect(page.locator('#totals')).not.toContainText('∞')
  await expect(page.locator('#totals')).not.toContainText('NaN')
})

test('不正な数値は赤枠表示され、0として扱われる', async ({ page }) => {
  await start(page)
  await page.fill('.in-qty >> nth=0', 'あいう')
  await expect(page.locator('.in-qty >> nth=0')).toHaveClass(/bad/)
  await expect(page.locator('#totals .grand')).toContainText('¥0')
})

test('端数処理の切り替えが合計に反映される', async ({ page }) => {
  await start(page)
  await page.fill('.in-qty >> nth=0', '1')
  await page.fill('.in-price >> nth=0', '105')
  await page.selectOption('#inv-rounding', 'floor')
  await expect(page.locator('#totals')).toContainText('消費税 ¥10')
  await page.selectOption('#inv-rounding', 'ceil')
  await expect(page.locator('#totals')).toContainText('消費税 ¥11')
})

test('税込入力に切り替えると内税が逆算される', async ({ page }) => {
  await start(page)
  await page.fill('.in-qty >> nth=0', '1')
  await page.fill('.in-price >> nth=0', '1100')
  await page.selectOption('#inv-taxmode', 'inclusive')
  await expect(page.locator('#totals')).toContainText('税抜 ¥1,000 ／ 消費税 ¥100')
  await expect(page.locator('#totals .grand')).toContainText('¥1,100')
})

test('複製・削除ができ、削除は確認ダイアログを出す', async ({ page }) => {
  await start(page)
  await page.fill('.in-price >> nth=0', '100')
  await page.click('#btn-save')
  await page.locator('#list-body button', { hasText: '複製' }).click()
  await expect(page.locator('#list-body tr')).toHaveCount(2)
  page.once('dialog', (d) => d.dismiss())
  await page.locator('#list-body button', { hasText: '削除' }).first().click()
  await expect(page.locator('#list-body tr')).toHaveCount(2)
  page.once('dialog', (d) => d.accept())
  await page.locator('#list-body button', { hasText: '削除' }).first().click()
  await expect(page.locator('#list-body tr')).toHaveCount(1)
})

test('明細をすべて削除すると保存できない', async ({ page }) => {
  await start(page)
  await page.click('#items-body button')
  await page.click('#btn-save')
  await expect(page.locator('#edit-errors')).toContainText('明細')
})

test('CSV内の式インジェクション文字列が無害化される', async ({ page }) => {
  await page.goto('/')
  await page.click('#btn-new')
  await page.fill('#inv-customer', '=HYPERLINK("http://x")')
  await page.fill('.in-name >> nth=0', '品')
  await page.click('#btn-save')
  const dl = page.waitForEvent('download')
  await page.click('#btn-csv')
  const fs = await import('node:fs')
  const text = fs.readFileSync((await (await dl).path())!, 'utf8')
  expect(text).toContain(`"'=HYPERLINK(""http://x"")"`)
})

test('印刷表示では操作UIが非表示で請求書のみになる', async ({ page }) => {
  await start(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#editor')).toBeHidden()
  await expect(page.locator('.site-header')).toBeHidden()
  await expect(page.locator('#sheet')).toBeVisible()
})

test('PC幅(1280px)でも崩れない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await start(page)
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(over).toBe(false)
})

test('200桁の数字(積がオーバーフロー)を入力しても ∞ / NaN が表示されない', async ({ page }) => {
  await start(page)
  await page.fill('.in-qty >> nth=0', '9'.repeat(200))
  await page.fill('.in-price >> nth=0', '9'.repeat(200))
  await expect(page.locator('#totals')).not.toContainText('∞')
  await expect(page.locator('#totals')).not.toContainText('NaN')
  await expect(page.locator('.in-qty >> nth=0')).toHaveClass(/bad/)
})
