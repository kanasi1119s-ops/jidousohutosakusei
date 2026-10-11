import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasics(page: Page) {
  await page.fill('#issuer-name', '山田デザイン事務所')
  await page.fill('#issuer-reg', 'T1234567890123')
  await page.fill('#inv-recipient', '株式会社サンプル')
  await page.fill('[aria-label="明細1の品名"]', 'ロゴ制作')
  await page.fill('[aria-label="明細1の単価"]', '100000')
}

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await expect(page.getByText('登録不要・オフライン対応')).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFで保存' })).toBeVisible()
  await expect(page.locator('#invoice-preview .doc-title')).toHaveText('請求書')
})

test('入力するとプレビューと税額が更新される', async ({ page }) => {
  await page.goto('/')
  await fillBasics(page)
  const preview = page.locator('#invoice-preview')
  await expect(preview).toContainText('株式会社サンプル 御中')
  await expect(preview).toContainText('登録番号: T1234567890123')
  await expect(preview).toContainText('ロゴ制作')
  await expect(preview.locator('.grand-amount')).toHaveText('¥110,000')
  await expect(page.locator('tr[data-x], td.amount').first()).toHaveText('¥100,000')
})

test('軽減税率の明細に※が付き、税率別に内訳が出る', async ({ page }) => {
  await page.goto('/')
  await fillBasics(page)
  await page.click('#add-line')
  await page.fill('[aria-label="明細2の品名"]', 'お菓子')
  await page.fill('[aria-label="明細2の単価"]', '500')
  await page.selectOption('[aria-label="明細2の税率"]', '8')
  const preview = page.locator('#invoice-preview')
  await expect(preview).toContainText('※ お菓子')
  await expect(preview).toContainText('軽減税率（8%）の対象品目')
  await expect(preview.locator('table.breakdown tbody tr')).toHaveCount(2)
  await expect(preview.locator('.grand-amount')).toHaveText('¥110,540')
})

test('全角数字で入力しても計算される', async ({ page }) => {
  await page.goto('/')
  await fillBasics(page)
  await page.fill('[aria-label="明細1の単価"]', '２００，０００')
  await expect(page.locator('#invoice-preview .grand-amount')).toHaveText('¥220,000')
})

test('記載事項チェックが入力に応じて変わる', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#check-list li.ng').first()).toBeVisible()
  await fillBasics(page)
  await expect(page.locator('#check-list li.ng')).toHaveCount(0)
})

test('源泉徴収を有効にすると請求額から差し引かれる', async ({ page }) => {
  await page.goto('/')
  await fillBasics(page)
  await page.check('#inv-withholding')
  await expect(page.locator('#invoice-preview .grand-amount')).toHaveText('¥99,790')
  await expect(page.locator('#invoice-preview')).toContainText('源泉徴収税額')
})

test('CSVがBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasics(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-list-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('株式会社サンプル')
  expect(text).not.toContain('�')
})

test('JSONバックアップのエクスポート→インポートで内容が復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasics(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#issuer-name')).toHaveValue('')

  await page.setInputFiles('#import-json', path)
  await expect(page.locator('#status')).toContainText('読み込みました')
  await expect(page.locator('#issuer-name')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#invoice-preview .grand-amount')).toHaveText('¥110,000')
})
