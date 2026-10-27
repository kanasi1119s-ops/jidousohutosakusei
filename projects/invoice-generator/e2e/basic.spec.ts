import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#clientName', '株式会社テスト')
  await page.fill('#invoiceNumber', 'INV-001')
  await page.fill('#issuer-name', '山田太郎')
  await page.fill('#issuer-reg', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#item-name-0', 'デザイン制作費')
  await page.fill('#item-qty-0', '2')
  await page.fill('#item-price-0', '50000')
}

test('日本語の見出しと主要UIが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('適格請求書ジェネレーター')
  await expect(page.getByRole('button', { name: 'PDFとして保存／印刷' })).toBeVisible()
  await expect(page.getByRole('button', { name: '明細を追加' })).toBeVisible()
  await expect(page.locator('footer')).toContainText('税務・法律上の助言ではありません')
})

test('入力すると請求書プレビューと税額が更新される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const preview = page.locator('#invoice-preview')
  await expect(preview).toContainText('請求書（適格請求書）')
  await expect(preview).toContainText('株式会社テスト 御中')
  await expect(preview).toContainText('登録番号: T1234567890123')
  await expect(preview).toContainText('合計（税込）')
  await expect(preview).toContainText('¥110,000')
  await expect(preview).toContainText('10%対象 消費税額')
  await expect(page.locator('#checklist')).toContainText('すべて満たしています')
})

test('軽減税率の明細に※が付き、税率ごとに集計される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  await page.fill('#item-name-1', '食品')
  await page.fill('#item-price-1', '1000')
  await page.selectOption('#item-rate-1', '8')
  const preview = page.locator('#invoice-preview')
  await expect(preview).toContainText('食品 ※')
  await expect(preview).toContainText('8%対象 消費税額')
  await expect(preview).toContainText('¥111,080')
})

test('登録番号が未入力だと適格請求書の要件が満たされない旨を表示する', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', 'A社')
  await expect(page.locator('#checklist')).toContainText('未入力の項目があります')
  await expect(page.locator('#invoice-preview')).not.toContainText('適格請求書')
})

test('源泉徴収を有効にすると差引請求額が表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.check('#withholding')
  const preview = page.locator('#invoice-preview')
  await expect(preview).toContainText('源泉徴収税額')
  await expect(preview).toContainText('-¥10,210')
  await expect(preview).toContainText('¥99,790')
})

test('CSVエクスポートがBOM付きUTF-8で、英数字のファイル名になる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-INV-001-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('デザイン制作費')
  expect(text).not.toContain('\uFFFD')
})

test('JSONのバックアップを書き出し、別の状態へ読み込み直せる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-generator-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const jsonPath = (await download.path())!

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('')

  await page.setInputFiles('#import-json', jsonPath)
  await expect(page.locator('#status')).toContainText('読み込みました')
  await expect(page.locator('#clientName')).toHaveValue('株式会社テスト')
  await expect(page.locator('#item-name-0')).toHaveValue('デザイン制作費')
})

test('請求書を保存して一覧から読み込める', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list')).toContainText('INV-001')
  await page.click('#new-invoice')
  await expect(page.locator('#clientName')).toHaveValue('')
  await expect(page.locator('#issuer-name')).toHaveValue('山田太郎')
  await page.getByRole('button', { name: '読み込む', exact: true }).click()
  await expect(page.locator('#clientName')).toHaveValue('株式会社テスト')
})
