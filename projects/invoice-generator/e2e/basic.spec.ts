import { test, expect, type Page } from '@playwright/test'
import os from 'node:os'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#issuerRegNo', 'T1234567890123')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#invoiceNo', 'INV-001')
  await page.fill('#item-0-name', 'ロゴ制作')
  await page.fill('#item-0-qty', '２')
  await page.fill('#item-0-price', '１０，５００')
}

test('日本語の見出しが正しく表示され、入力が即時にプレビューへ反映される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await fillBasic(page)
  await expect(page.locator('#pv-client')).toHaveText('株式会社サンプル 御中')
  // 21000 + 税2100
  await expect(page.locator('#pv-total')).toContainText('¥23,100')
  await expect(page.locator('#errors li')).toHaveCount(0)
})

test('未入力だと不足項目の警告が出る', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#errors')).toContainText('登録番号')
})

test('CSVはBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^invoice-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('ロゴ制作')
})

test('保存→再読み込みで復元され、JSONバックアップを往復できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('INV-001 株式会社サンプル')

  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const path = (await (await dl).path())!
  const json = fs.readFileSync(path, 'utf8')
  expect(json).toContain('株式会社サンプル')

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved-list li')).toHaveCount(0)
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#message')).toContainText('1件をインポート')
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
})

test('不正なJSONのインポートはエラー表示で落ちない', async ({ page }) => {
  await page.goto('/')
  const bad = os.tmpdir() + '/bad-invoice.json'
  fs.writeFileSync(bad, '{broken')
  await page.setInputFiles('#import-file', bad)
  await expect(page.locator('#message')).toContainText('失敗')
  fs.unlinkSync(bad)
})

test('ネットワーク遮断後もオフラインで開ける', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書ジェネレーター')
})
