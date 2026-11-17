import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function fill(page: import('@playwright/test').Page) {
  await page.fill('#sellerName', '山田デザイン事務所')
  await page.fill('#sellerRegNo', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#buyerName', '株式会社サンプル')
  await page.fill('[aria-label="品名1"]', 'ロゴ制作費')
  await page.fill('[aria-label="単価1"]', '１０，０００')
}

test('日本語の見出しとプレビューが表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#doc h2')).toHaveText('請求書')
})

test('全角入力でも正しく計算されプレビューに反映される', async ({ page }) => {
  await page.goto('/')
  await fill(page)
  await expect(page.locator('#doc-total')).toContainText('¥11,000')
  await expect(page.locator('#doc-regno')).toContainText('T1234567890123')
  await expect(page.locator('#doc')).toContainText('株式会社サンプル 御中')
})

test('必須項目が足りないと印刷時にエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => (window.print = () => {}))
  await page.click('#print')
  await expect(page.locator('#errors')).toContainText('登録番号')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名は英数字', async ({ page }) => {
  await page.goto('/')
  await fill(page)
  await page.fill('#invoiceNo', '請求-2026')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('ロゴ制作費')
})

test('保存→再読み込みで復元、JSON往復で復元できる', async ({ page }) => {
  await page.goto('/')
  await fill(page)
  await page.click('#save')
  await page.reload()
  await expect(page.locator('#saved')).toContainText('株式会社サンプル')

  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const path = (await (await dl).path())!
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved')).toContainText('保存済みの請求書はありません')
  await page.setInputFiles('#import-json', path)
  await expect(page.locator('#saved')).toContainText('株式会社サンプル')
  await page.locator('#saved button', { hasText: '開く' }).first().click()
  await expect(page.locator('#sellerName')).toHaveValue('山田デザイン事務所')
})

test('不正なインポートファイルはエラー表示で壊れない', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-json', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
  await expect(page.locator('#status')).toContainText('インポートに失敗')
})

test('XSS文字列がそのまま文字として表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#buyerName', '<img src=x onerror=alert(1)>')
  await expect(page.locator('#doc img')).toHaveCount(0)
  await expect(page.locator('#doc')).toContainText('<img src=x')
})

test('オフラインでも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // SW制御下に入れる
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await page.fill('[aria-label="単価1"]', '500')
  await expect(page.locator('#doc-total')).toContainText('¥550')
})
