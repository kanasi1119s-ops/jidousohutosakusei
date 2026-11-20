import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#issuerRegNo', 'T1234567890123')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#invoiceNumber', 'INV-001')
  await page.fill('.it-desc >> nth=0', 'ロゴ制作')
  await page.fill('.it-unit >> nth=0', '10000')
}

test('日本語の見出しとプレビューが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書メーカー')
  await expect(page.getByRole('button', { name: 'PDFとして保存・印刷' })).toBeVisible()
  await fillBasic(page)
  const pv = page.locator('#preview')
  await expect(pv).toContainText('請求書')
  await expect(pv).toContainText('株式会社サンプル 御中')
  await expect(pv).toContainText('登録番号: T1234567890123')
  await expect(pv).toContainText('合計(税込)')
  await expect(pv).toContainText('¥11,000')
  await expect(page.locator('#warnings li')).toHaveCount(0)
})

test('10%と8%が混在すると税率ごとに表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  await page.fill('.it-desc >> nth=1', '食品')
  await page.fill('.it-unit >> nth=1', '１，０００')
  await page.selectOption('.it-rate >> nth=1', '8')
  const pv = page.locator('#preview')
  await expect(pv).toContainText('8%対象 消費税額')
  await expect(pv).toContainText('10%対象 消費税額')
  await expect(pv).toContainText('¥12,080')
  await expect(pv).toContainText('※ は軽減税率')
})

test('必須項目が未入力なら警告が出る', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#warnings')).toContainText('登録番号が未入力')
  await page.fill('#issuerRegNo', 'T12')
  await expect(page.locator('#warnings')).toContainText('形式が不正')
})

test('入力は再読み込み後も復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#preview')).toContainText('¥11,000')
})

test('CSVはBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^[A-Za-z0-9_-]+\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('ロゴ制作')
})

test('バックアップのエクスポート→インポート往復', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list li')).toContainText('INV-001')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const d = await dl
  const path = (await d.path())!
  expect(d.suggestedFilename()).toMatch(/^[A-Za-z0-9_-]+\.json$/)

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#message')).toContainText('読み込みました')
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#saved-list li')).toContainText('INV-001')
})

test('bad backup shows error', async ({ page }, info) => {
  await page.goto('/')
  const p = info.outputPath('bad.json')
  fs.mkdirSync(info.outputDir, { recursive: true })
  fs.writeFileSync(p, '{"schema":"x"}')
  await page.setInputFiles('#import-file', p)
  await expect(page.locator('#message')).toContainText('バックアップファイルではありません')
})

test('XSS文字列がHTMLとして解釈されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror=window.__xss=1>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('画面幅で横スクロールが発生しない', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('オフラインでも動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書メーカー')
  await page.fill('.it-unit >> nth=0', '500')
  await expect(page.locator('#preview')).toContainText('¥550')
})

test('桁あふれ入力は無効扱いで金額が壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('.it-unit >> nth=0', '1000')
  await page.fill('.it-unit >> nth=0', '99999999999999999999')
  await expect(page.locator('.it-unit >> nth=0')).toHaveClass(/invalid/)
  await expect(page.locator('#preview')).toContainText('¥1,100')
})

test('印刷表示では入力フォームが隠れ請求書のみ表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#form')).toBeHidden()
  await expect(page.locator('h1')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
})
