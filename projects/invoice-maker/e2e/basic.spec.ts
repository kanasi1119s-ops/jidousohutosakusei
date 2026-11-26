import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function fillFirstItem(page: import('@playwright/test').Page, name: string, qty: string, price: string) {
  const row = page.locator('.item-row').first()
  await row.locator('[data-role=item-name]').fill(name)
  await row.locator('[data-role=item-qty]').fill(qty)
  await row.locator('[data-role=item-price]').fill(price)
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await expect(page.getByText('登録不要・オフライン対応')).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFに保存' })).toBeVisible()
})

test('明細を入力すると税率別の合計が計算される', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, 'Webサイト制作', '2', '5000')
  await expect(page.locator('#grand-total')).toContainText('11,000円')
  await page.click('#add-item')
  const row = page.locator('.item-row').nth(1)
  await row.locator('[data-role=item-price]').fill('100')
  await row.locator('[data-role=item-rate]').selectOption('8')
  await expect(page.locator('tr[data-rate="8"]')).toContainText('消費税 8円')
  await expect(page.locator('tr[data-rate="10"]')).toContainText('消費税 1,000円')
  await expect(page.locator('#grand-total')).toContainText('11,108円')
})

test('全角数字でも入力できる', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, '商品', '１', '１，０００')
  await expect(page.locator('#grand-total')).toContainText('1,100円')
})

test('不正な数量でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, '商品', 'abc', '100')
  await expect(page.locator('#errors')).toContainText('数量は0以上')
})

test('登録番号の形式エラーと適格請求書表示', async ({ page }) => {
  await page.goto('/')
  await page.fill('#registrationNumber', 'T123')
  await expect(page.locator('#reg-error')).toContainText('13桁')
  await expect(page.locator('.doc-title')).toHaveText('請求書')
  await page.fill('#registrationNumber', 'T1234567890123')
  await expect(page.locator('#reg-error')).toHaveText('')
  await expect(page.locator('.doc-title')).toHaveText('請求書（適格請求書）')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名は英数字', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, '制作費', '1', '1000')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('品目,数量')
  expect(buf.toString('utf-8')).toContain('制作費')
})

test('JSONバックアップの往復と再読み込み後の復元', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerName', '株式会社テスト')
  await fillFirstItem(page, '保守費用', '3', '2000')
  await page.reload()
  await expect(page.locator('#issuerName')).toHaveValue('株式会社テスト')
  await expect(page.locator('#grand-total')).toContainText('6,600円')

  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!

  page.once('dialog', (d) => d.accept())
  await page.click('#clear')
  await expect(page.locator('#issuerName')).toHaveValue('')
  await page.setInputFiles('#import-json', path)
  await expect(page.locator('#issuerName')).toHaveValue('株式会社テスト')
  await expect(page.locator('#grand-total')).toContainText('6,600円')
})
