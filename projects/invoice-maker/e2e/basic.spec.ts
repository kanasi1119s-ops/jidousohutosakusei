import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function fillBasic(page: import('@playwright/test').Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#registrationNumber', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#customerName', '株式会社サンプル')
  await page.fill('#invoiceNumber', 'INV-001')
  await page.locator('.it-name').first().fill('ロゴ制作')
  await page.locator('.it-qty').first().fill('１')
  await page.locator('.it-price').first().fill('１０，５００')
}

test('日本語の見出し・ラベルが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書メーカー')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('#preview h2')).toHaveText('請求書')
  await expect(page.getByRole('button', { name: '印刷 / PDFで保存' })).toBeVisible()
})

test('全角入力でも計算され、プレビューに税率ごとの内訳が出る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await expect(page.locator('#grand-total')).toContainText('¥11,550')
  await expect(page.locator('#preview-summary')).toContainText('10%対象')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
  await expect(page.locator('#errors')).toHaveText('')
})

test('軽減税率の明細を追加すると8%区分と※が出る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  await page.locator('.it-name').nth(1).fill('お弁当')
  await page.locator('.it-price').nth(1).fill('500')
  await page.locator('.it-rate').nth(1).selectOption('8')
  await expect(page.locator('#preview-summary')).toContainText('8%対象')
  await expect(page.locator('#preview')).toContainText('軽減税率')
})

test('必須未入力でエラー表示', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#errors')).toContainText('宛名')
})

test('CSVがBOM付きUTF-8・英数字ファイル名', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^invoice-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('ロゴ制作')
})

test('保存→再読み込みで復元、JSONエクスポート→インポート往復', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list li')).toContainText('INV-001')
  await page.reload()
  await expect(page.locator('#customerName')).toHaveValue('株式会社サンプル')

  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const d = await dl
  const p = (await d.path())!
  await page.fill('#customerName', '別の会社')
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fc.setFiles(p)
  await expect(page.locator('#customerName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#import-msg')).toContainText('インポートしました')
})

test('不正なJSONのインポートはエラーメッセージ', async ({ page }) => {
  await page.goto('/')
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'im-')), 'bad.json')
  
  fs.writeFileSync(f, '{"hello":1}')
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fc.setFiles(f)
  await expect(page.locator('#import-msg')).toContainText('形式が不正')
})

test('HTML特殊文字はエスケープされて表示される（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#customerName', '<img src=x onerror="window.__x=1">')
  await expect(page.locator('#preview .to')).toContainText('<img')
  expect(await page.evaluate(() => (window as any).__x)).toBeUndefined()
})

test('スマホ幅で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await fillBasic(page)
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(over).toBe(false)
})

test('オフラインでも再読み込みして動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書メーカー')
  await page.fill('#customerName', 'オフライン商事')
  await expect(page.locator('#preview .to')).toContainText('オフライン商事')
})
