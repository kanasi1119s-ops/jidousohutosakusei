import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: import('@playwright/test').Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#registrationNumber', 'T1234567890123')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#number', 'INV-0001')
  const row = page.locator('#items-body tr').first()
  await row.locator('.it-name').fill('ロゴ制作')
  await row.locator('.it-qty').fill('１')
  await row.locator('.it-price').fill('１０，０００')
}

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#save')).toHaveText('この請求書を保存')
  await expect(page.locator('#print')).toHaveText('印刷 / PDFとして保存')
})

test('全角入力でも計算され、プレビューに請求額が反映される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await expect(page.locator('#pv-total')).toHaveText('ご請求額 11,000円')
  await expect(page.locator('#pv-client')).toContainText('株式会社サンプル 御中')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
})

test('源泉徴収を選ぶと請求額から差し引かれる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.selectOption('#withholding', 'yes')
  await expect(page.locator('#pv-total')).toHaveText('ご請求額 9,979円')
})

test('登録番号の形式が不正だとエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#registrationNumber', 'T12')
  await expect(page.locator('#messages')).toContainText('登録番号')
})

test('請求書番号なしでは保存できず、保存後は一覧に表示され再読み込み後も残る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.fill('#number', '')
  await page.click('#save')
  await expect(page.locator('#messages')).toContainText('請求書番号')
  await page.fill('#number', 'INV-0001')
  await page.click('#save')
  await expect(page.locator('#saved-list li')).toContainText('INV-0001')
  await page.reload()
  await expect(page.locator('#saved-list li')).toContainText('株式会社サンプル')
})

test('CSVはBOM付きUTF-8で日本語ヘッダーを含み、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-list-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('株式会社サンプル')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('バックアップ(JSON)の書き出し→削除→読み込みで復元できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!

  page.once('dialog', (d) => d.accept())
  await page.locator('#saved-list li button.danger').click()
  await expect(page.locator('#saved-list')).toContainText('まだありません')

  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#saved-list li')).toContainText('株式会社サンプル')
})

test('不正なJSONを読み込むとエラー表示になり落ちない', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"invoices": 1}') })
  await expect(page.locator('#messages')).toContainText('見つかりません')
})
