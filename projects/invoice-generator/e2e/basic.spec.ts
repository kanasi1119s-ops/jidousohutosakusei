import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuer-name', '山田デザイン事務所')
  await page.fill('#issuer-reg', 'T1234567890123')
  await page.fill('#inv-client', '株式会社サンプル')
  await page.fill('#line-0-name', 'ロゴデザイン')
  await page.fill('#line-0-qty', '1')
  await page.fill('#line-0-unitPrice', '100000')
}

test('日本語の見出し・ボタン・プレビューが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#save')).toHaveText('この請求書を保存')
  await expect(page.locator('#print')).toHaveText('印刷 / PDFで保存')
  await expect(page.locator('#sheet')).toContainText('請求書')
})

test('入力に応じて金額が計算され、適格請求書の記載事項が出る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await expect(page.locator('#sheet')).toContainText('請求書（適格請求書）')
  await expect(page.locator('#sheet')).toContainText('登録番号: T1234567890123')
  await expect(page.locator('#sheet')).toContainText('株式会社サンプル 御中')
  await expect(page.locator('#sheet')).toContainText('10%対象 消費税額')
  await expect(page.locator('#sheet-total')).toHaveText('¥110,000')
})

test('軽減税率行と全角数字入力', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-line')
  await page.fill('#line-1-name', 'お土産')
  await page.fill('#line-1-qty', '３')
  await page.fill('#line-1-unitPrice', '１，０００')
  await page.selectOption('#line-1-rate', '8')
  await expect(page.locator('#sheet')).toContainText('お土産 ※')
  await expect(page.locator('#sheet')).toContainText('※は軽減税率（8%）対象')
  await expect(page.locator('#sheet')).toContainText('8%対象 消費税額')
  // 100000*1.1 + 3000*1.08 = 110000 + 3240
  await expect(page.locator('#sheet-total')).toHaveText('¥113,240')
})

test('源泉徴収を差し引く', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.check('#inv-withholding')
  await expect(page.locator('#sheet-withholding')).toHaveText('-¥10,210')
  await expect(page.locator('#sheet-payable')).toHaveText('¥99,790')
})

test('保存→再読み込み後に復元される（発行者情報の自動復元を含む）', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  await expect(page.locator('#message')).toContainText('保存しました')
  await page.reload()
  await expect(page.locator('#issuer-name')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
  await page.click('#saved-list [data-action="open"]')
  await expect(page.locator('#line-0-name')).toHaveValue('ロゴデザイン')
  await expect(page.locator('#sheet-total')).toHaveText('¥110,000')
})

test('保存済みの削除は2段階確認', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  await page.click('#saved-list [data-action="delete"]')
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
  await page.click('#saved-list [data-action="delete"]')
  await expect(page.locator('#saved-list')).toContainText('保存済みの請求書はまだありません')
})

test('CSVがBOM付きUTF-8・英数字ファイル名で書き出される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('株式会社サンプル')
  expect(text).not.toContain('�')
})

test('バックアップJSONの書き出し→全消去→読み込みで復元できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-generator-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!
  const raw = fs.readFileSync(path)
  expect(raw[0]).not.toBe(0xef) // JSONはBOMなし
  expect(raw.toString('utf-8')).toContain('山田デザイン事務所')

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#issuer-name')).toHaveValue('')
  await page.setInputFiles('#import-json', path)
  await expect(page.locator('#message')).toContainText('読み込みました')
  await expect(page.locator('#issuer-name')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
})

test('印刷用スタイルでは請求書本体だけが表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#sheet')).toBeVisible()
  await expect(page.locator('#editor')).toBeHidden()
  await expect(page.locator('.site-header')).toBeHidden()
})
