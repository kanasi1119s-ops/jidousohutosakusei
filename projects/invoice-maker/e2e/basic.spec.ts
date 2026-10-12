import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

const REPLACEMENT_CHAR = String.fromCharCode(0xfffd)

async function fillItem(page: Page, row: number, name: string, qty: string, price: string, rate?: string) {
  const tr = page.locator('#items-body tr').nth(row)
  await tr.locator('[data-field="name"]').fill(name)
  await tr.locator('[data-field="quantity"]').fill(qty)
  await tr.locator('[data-field="unitPriceYen"]').fill(price)
  if (rate) await tr.locator('[data-field="taxRate"]').selectOption(rate)
}

async function readDownload(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download'), click()])
  const path = await download.path()
  return { name: download.suggestedFilename(), bytes: fs.readFileSync(path!) }
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('#sheet h2.doc-title')).toHaveText('請求書')
  await expect(page.getByRole('button', { name: '印刷 / PDFで保存' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
})

test('明細を入力すると請求金額が計算される', async ({ page }) => {
  await page.goto('/')
  await fillItem(page, 0, 'デザイン制作費', '2', '1000')
  await expect(page.locator('#grand-total')).toHaveText('2,200円')
  await expect(page.locator('#sheet')).toContainText('デザイン制作費')
})

test('税率ごとに1回だけ端数処理される', async ({ page }) => {
  await page.goto('/')
  await fillItem(page, 0, 'A', '1', '105')
  await page.click('#add-item')
  await fillItem(page, 1, 'B', '1', '105')
  await page.click('#add-item')
  await fillItem(page, 2, 'C', '1', '105')
  // 行ごとに切り捨てると 315+30=345円、請求書単位で処理すると 315+31=346円
  await expect(page.locator('#grand-total')).toHaveText('346円')
})

test('軽減税率・非課税・税込入力を扱える', async ({ page }) => {
  await page.goto('/')
  await fillItem(page, 0, '食品', '1', '1080', '8')
  await page.selectOption('#priceMode', 'inclusive')
  await expect(page.locator('#grand-total')).toHaveText('1,080円')
  await expect(page.locator('#sheet')).toContainText('8%対象（軽減税率）')
})

test('源泉徴収を有効にすると差引請求額が表示される', async ({ page }) => {
  await page.goto('/')
  await fillItem(page, 0, '原稿料', '1', '100000')
  await page.check('#withholding')
  await expect(page.locator('#grand-total')).toHaveText('99,790円')
  await expect(page.locator('#sheet')).toContainText('差引請求額')
})

test('登録番号の形式を適格請求書チェックで確認できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerReg', '12345')
  await expect(page.locator('#checks li.ng', { hasText: '登録番号' })).toBeVisible()
  await page.fill('#issuerReg', 'T1234567890123')
  await expect(page.locator('#checks li.ok', { hasText: '登録番号' })).toBeVisible()
})

test('保存した請求書がリロード後も残り、編集中の内容も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#clientName', '株式会社サンプル')
  await fillItem(page, 0, 'ロゴ制作', '1', '50000')
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list li[data-id]')).toHaveCount(1)
  await page.fill('#notes', '編集中のメモ')
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
  await expect(page.locator('#issuerName')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#notes')).toHaveValue('編集中のメモ')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名が英数字のみ', async ({ page }) => {
  await page.goto('/')
  await page.fill('#invoiceNumber', 'INV-2026-001')
  await fillItem(page, 0, '制作費', '1', '1000')
  const { name, bytes } = await readDownload(page, () => page.click('#export-csv'))
  expect(name).toBe('invoice-INV-2026-001.csv')
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = bytes.toString('utf8')
  expect(text).toContain('品名,数量')
  expect(text).toContain('制作費')
  expect(text).not.toContain(REPLACEMENT_CHAR)
})

test('バックアップJSONの書き出し→削除→読み込みで復元できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '往復テスト商事')
  await fillItem(page, 0, '保守費用', '3', '12000')
  await page.click('#save-invoice')
  const { name, bytes } = await readDownload(page, () => page.click('#export-json'))
  expect(name).toMatch(/^invoice-maker-backup-[0-9-]+\.json$/)
  expect(bytes.toString('utf8')).toContain('往復テスト商事')

  page.once('dialog', (d) => d.accept())
  await page.locator('#saved-list li[data-id] button[data-action="delete"]').click()
  await expect(page.locator('#saved-list li[data-id]')).toHaveCount(0)

  await page.setInputFiles('#import-file', { name: 'b.json', mimeType: 'application/json', buffer: bytes })
  await expect(page.locator('#saved-list')).toContainText('往復テスト商事')
  await expect(page.locator('#messages')).toContainText('読み込みました')
})
