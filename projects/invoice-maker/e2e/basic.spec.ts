import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function fillFirstItem(page: import('@playwright/test').Page, name: string, qty: string, price: string) {
  await page.fill('#item-name-0', name)
  await page.fill('#item-qty-0', qty)
  await page.fill('#item-price-0', price)
}

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await expect(page.locator('#save-invoice')).toHaveText('保存する')
  await expect(page.locator('#print-invoice')).toHaveText('印刷 / PDFとして保存')
  await expect(page.locator('#tabbtn-settings')).toHaveText('設定')
  await expect(page.locator('footer')).toContainText('税務・法律上の助言ではありません')
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain('\uFFFD')
})

test('明細を入力すると税率別の合計が計算される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '株式会社テスト商事')
  await fillFirstItem(page, 'Webサイト制作', '1', '100000')
  await expect(page.locator('#sum-subtotal')).toHaveText('¥100,000')
  await expect(page.locator('#sum-tax')).toHaveText('¥10,000')
  await expect(page.locator('#sum-total')).toHaveText('¥110,000')
  await expect(page.locator('#preview')).toContainText('株式会社テスト商事 御中')

  // 軽減税率の行を追加
  await page.click('#add-item')
  await page.fill('#item-name-1', '菓子折り')
  await page.fill('#item-qty-1', '３')
  await page.fill('#item-price-1', '１，０００')
  await page.selectOption('#item-rate-1', '8')
  await expect(page.locator('#sum-subtotal')).toHaveText('¥103,000')
  await expect(page.locator('#sum-tax')).toHaveText('¥10,240')
  await expect(page.locator('#preview')).toContainText('軽減税率')
})

test('源泉徴収を有効にすると請求金額から差し引かれる', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, '執筆', '1', '100000')
  await page.check('#withholding')
  await expect(page.locator('#sum-withholding')).toHaveText('-¥10,210')
  await expect(page.locator('#sum-total')).toHaveText('¥99,790')
})

test('設定→保存→リロード後も復元され、請求書にも反映される', async ({ page }) => {
  await page.goto('/')
  await page.click('#tabbtn-settings')
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#registrationNumber', 'ｔ１２３４５６７８９０１２３')
  await page.click('#save-settings')
  await expect(page.locator('#settings-msg')).toHaveText('設定を保存しました。')
  await page.reload()
  await page.click('#tabbtn-settings')
  await expect(page.locator('#issuerName')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#registrationNumber')).toHaveValue('T1234567890123')
  await page.click('#tabbtn-create')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
  await expect(page.locator('#warnings')).toHaveText('')
})

test('保存した請求書が一覧に出て、開く・複製・削除できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '有限会社サンプル')
  await fillFirstItem(page, '保守', '2', '5000')
  await page.click('#save-invoice')
  await expect(page.locator('#status')).toContainText('INV-0001 を保存しました')
  await page.click('#tabbtn-list')
  await expect(page.locator('#list-body tr')).toHaveCount(1)
  await expect(page.locator('#list-body')).toContainText('有限会社サンプル御中')
  await expect(page.locator('#list-body')).toContainText('¥11,000')

  await page.click('.copy-invoice')
  await expect(page.locator('#invoiceNumber')).toHaveValue('INV-0002')
  await page.click('#save-invoice')
  await page.click('#tabbtn-list')
  await expect(page.locator('#list-body tr')).toHaveCount(2)

  page.once('dialog', (d) => d.accept())
  await page.locator('.delete-invoice').first().click()
  await expect(page.locator('#list-body tr')).toHaveCount(1)
})

test('CSVはBOM付きUTF-8で、日本語がそのまま入っている', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '株式会社テスト商事')
  await fillFirstItem(page, '制作', '1', '1000')
  await page.click('#save-invoice')
  await page.click('#tabbtn-data')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  expect(download.suggestedFilename()).toMatch(/^invoice-list-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync(await download.path())
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('株式会社テスト商事御中')
  expect(text).not.toContain('\uFFFD')
})
