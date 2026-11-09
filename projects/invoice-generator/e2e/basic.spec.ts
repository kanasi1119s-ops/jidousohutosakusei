import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuer-name', '山田デザイン')
  await page.fill('#issuer-reg', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#customer', '株式会社サンプル')
  await page.fill('[aria-label="品名1"]', 'ロゴ制作')
  await page.fill('[aria-label="単価1"]', '１０，０００')
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書ジェネレーター')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('#preview h2')).toHaveText('請 求 書')
})

test('入力すると税率ごとの消費税額と登録番号がプレビューに出る（全角入力も可）', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const preview = page.locator('#preview')
  await expect(preview).toContainText('株式会社サンプル 御中')
  await expect(preview).toContainText('T1234567890123')
  await expect(preview).toContainText('¥11,000')
  await expect(preview).toContainText('10%対象')
  await expect(page.locator('#messages')).not.toContainText('登録番号が未入力')
})

test('軽減税率の明細を追加すると8%区分が別行で出る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  await page.fill('[aria-label="品名2"]', 'お菓子')
  await page.fill('[aria-label="単価2"]', '1000')
  await page.selectOption('[aria-label="税率2"]', '8')
  await expect(page.locator('#preview')).toContainText('8%対象（軽減税率）')
  await expect(page.locator('#preview')).toContainText('※は軽減税率')
  await expect(page.locator('#preview')).toContainText('¥12,080')
})

test('必須項目が欠けていると保存できずエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.click('#save-invoice')
  await expect(page.locator('#messages')).toContainText('宛名')
  await expect(page.locator('#status')).toContainText('保存していません')
  await expect(page.locator('#saved-body tr')).toHaveCount(0)
})

test('保存→再読み込みで一覧に復元され、開いて内容を再現できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  await expect(page.locator('#saved-body tr')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('#saved-body tr')).toHaveCount(1)
  await expect(page.locator('#issuer-name')).toHaveValue('山田デザイン')
  await page.click('[data-load]')
  await expect(page.locator('#customer')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#preview')).toContainText('¥11,000')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
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

test('JSONバックアップの書き出し→全削除→読み込みで復元できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const jsonPath = (await download.path())!

  page.once('dialog', (d) => d.accept())
  await page.click('[data-delete]')
  await expect(page.locator('#saved-body tr')).toHaveCount(0)

  await page.setInputFiles('#import-file', jsonPath)
  await expect(page.locator('#saved-body tr')).toHaveCount(1)
  await expect(page.locator('#saved-body')).toContainText('株式会社サンプル')
})
