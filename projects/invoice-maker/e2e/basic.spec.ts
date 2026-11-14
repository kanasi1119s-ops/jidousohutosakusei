import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillFirstItem(page: Page, name: string, qty: string, price: string) {
  await page.getByTestId('item-name').first().fill(name)
  await page.getByTestId('item-qty').first().fill(qty)
  await page.getByTestId('item-price').first().fill(price)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '請求書メーカー' })).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFとして保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV出力（Excel対応）' })).toBeVisible()
  const text = await page.locator('body').innerText()
  expect(text).not.toContain('\uFFFD')
})

test('明細入力で税込合計がプレビューに反映（全角数字も可）', async ({ page }) => {
  await fillFirstItem(page, 'デザイン費', '２', '５，０００')
  await expect(page.getByTestId('grand-total')).toContainText('¥11,000')
  await page.locator('#add-item').click()
  await page.getByTestId('item-name').nth(1).fill('弁当')
  await page.getByTestId('item-price').nth(1).fill('1000')
  await page.getByTestId('item-rate').nth(1).selectOption('8')
  await expect(page.getByTestId('grand-total')).toContainText('¥12,080')
  await expect(page.getByTestId('preview')).toContainText('軽減税率')
})

test('登録番号の形式チェック', async ({ page }) => {
  await page.locator('#issuer-regno').fill('T123')
  await expect(page.locator('#reg-hint')).toContainText('形式が正しくありません')
  await page.locator('#issuer-regno').fill('Ｔ１２３４５６７８９０１２３')
  await expect(page.locator('#reg-hint')).toContainText('形式OK')
  await expect(page.getByTestId('preview')).toContainText('登録番号: T1234567890123')
})

test('源泉徴収を差し引く', async ({ page }) => {
  await fillFirstItem(page, '原稿料', '1', '100000')
  await page.locator('#withholding').check()
  await expect(page.getByTestId('grand-total')).toContainText('¥99,790')
})

test('リロード後に入力が復元される', async ({ page }) => {
  await page.locator('#client-name').fill('株式会社テスト')
  await fillFirstItem(page, '開発費', '1', '30000')
  await page.reload()
  await expect(page.locator('#client-name')).toHaveValue('株式会社テスト')
  await expect(page.getByTestId('grand-total')).toContainText('¥33,000')
})

test('CSVはBOM付きUTF-8で日本語が保持される', async ({ page }) => {
  await fillFirstItem(page, '開発費', '1', '30000')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#export-csv').click()])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9_-]+\.csv$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const body = buf.toString('utf-8')
  expect(body).toContain('品名,数量')
  expect(body).toContain('開発費')
  expect(body).not.toContain('\uFFFD')
})

test('JSONバックアップ→新規→復元の往復', async ({ page }) => {
  await page.locator('#client-name').fill('往復テスト株式会社')
  await fillFirstItem(page, '保守費', '3', '1234')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#export-json').click()])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9_-]+\.json$/)
  const path = (await dl.path())!
  page.once('dialog', (d) => d.accept())
  await page.locator('#reset').click()
  await expect(page.locator('#client-name')).toHaveValue('')
  await page.locator('#import-file').setInputFiles(path)
  await expect(page.locator('#client-name')).toHaveValue('往復テスト株式会社')
  await expect(page.getByTestId('item-name').first()).toHaveValue('保守費')
})

test('不正なJSONは拒否され内容が壊れない', async ({ page }) => {
  await page.locator('#client-name').fill('保持されるべき')
  await page.locator('#import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') })
  await expect(page.locator('#status')).toContainText('読み込めませんでした')
  await expect(page.locator('#client-name')).toHaveValue('保持されるべき')
})
