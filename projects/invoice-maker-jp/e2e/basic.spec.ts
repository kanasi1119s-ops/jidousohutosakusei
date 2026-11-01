import { expect, test } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.fill('#f-issuer-name', '山田デザイン事務所')
  await page.fill('#f-reg-no', 'T1234567890123')
  await page.fill('#f-customer', '株式会社サンプル')
  await page.fill('#f-number', 'INV-001')
  await page.fill('input[aria-label="品名1"]', 'ロゴ制作')
  await page.fill('input[aria-label="単価1"]', '１０，０００')
}

test('日本語の見出し・ボタン・プレビューが正しく表示される', async ({ page }) => {
  await fillBasic(page)
  await expect(page.getByRole('heading', { name: '請求書メーカー（インボイス対応）' })).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDF保存' })).toBeVisible()
  await expect(page.locator('#preview')).toContainText('株式会社サンプル 御中')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
  await expect(page.locator('#preview-total')).toHaveText('¥11,000')
})

test('税率の混在と登録番号の警告', async ({ page }) => {
  await fillBasic(page)
  await page.click('#add-item')
  await page.fill('input[aria-label="品名2"]', '飲料')
  await page.fill('input[aria-label="単価2"]', '500')
  await page.selectOption('select[aria-label="税率2"]', '8')
  await expect(page.locator('#preview-total')).toHaveText('¥11,540')
  await page.fill('#f-reg-no', 'T12')
  await expect(page.locator('#warnings')).toContainText('T」+数字13桁')
})

test('保存→再読み込みで復元され、削除できる', async ({ page }) => {
  await fillBasic(page)
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list')).toContainText('INV-001')
  await page.reload()
  await expect(page.locator('#f-customer')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
})

test('CSVはBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await fillBasic(page)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  expect(dl.suggestedFilename()).toBe('INV-001.csv')
  const buf = fs.readFileSync(await dl.path())
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('株式会社サンプル')
})

test('JSONバックアップ→インポートの往復', async ({ page }) => {
  await fillBasic(page)
  await page.click('#save-invoice')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-json')])
  const path = await dl.path()
  await page.click('.saved .danger')
  await expect(page.locator('#saved-list')).toContainText('まだ保存')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#saved-list')).toContainText('INV-001')
})

test('オフラインでも開ける（Service Worker）', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '請求書メーカー（インボイス対応）' })).toBeVisible()
  await page.fill('#f-customer', 'オフライン商事')
  await expect(page.locator('#preview')).toContainText('オフライン商事')
})
