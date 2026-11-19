import { expect, test } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#regNo', 'T1234567890123')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#number', 'A-001')
  await page.fill('[data-row="0"] [data-f="name"]', 'ロゴデザイン')
  await page.fill('[data-row="0"] [data-f="quantity"]', '３')
  await page.fill('[data-row="0"] [data-f="unitPrice"]', '１，０００')
}

test('日本語の見出し・ボタンが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '請求書メーカー（インボイス対応）' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF保存・印刷' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '請求書', exact: true })).toBeVisible()
  const text = await page.locator('body').innerText()
  expect(text).not.toContain('�')
})

test('全角入力でも計算され、プレビューに税率別合計が出る', async ({ page }) => {
  await fillBasic(page)
  await expect(page.locator('#grand-total')).toHaveText('3,300円')
  await expect(page.locator('tr[data-rate="10"]')).toContainText('消費税 300円')
  await expect(page.locator('[data-t="client"]')).toContainText('株式会社サンプル 御中')
})

test('軽減税率の明細に※が付く', async ({ page }) => {
  await fillBasic(page)
  await page.click('#add-item')
  await page.fill('[data-row="1"] [data-f="name"]', 'お菓子')
  await page.fill('[data-row="1"] [data-f="unitPrice"]', '500')
  await page.selectOption('[data-row="1"] [data-f="taxRate"]', '8')
  await expect(page.locator('#sheet')).toContainText('お菓子※')
  await expect(page.locator('#sheet')).toContainText('軽減税率（8%）対象')
  await expect(page.locator('#grand-total')).toHaveText('3,840円')
})

test('リロード後も入力が復元される', async ({ page }) => {
  await fillBasic(page)
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#grand-total')).toHaveText('3,300円')
})

test('CSVは先頭3バイトがBOMで、ファイル名は英数字のみ', async ({ page }) => {
  await fillBasic(page)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.csv$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('ロゴデザイン')
})

test('JSONのエクスポート→インポートの往復', async ({ page }) => {
  await fillBasic(page)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-json')])
  const p = (await dl.path())!
  await page.click('#new-invoice')
  await expect(page.locator('#clientName')).toHaveValue('')
  await expect(page.locator('#issuerName')).toHaveValue('山田デザイン事務所')
  await page.setInputFiles('#import-file', p)
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#grand-total')).toHaveText('3,300円')
})

test('不正なJSONは日本語エラーを表示し、データを壊さない', async ({ page }) => {
  await fillBasic(page)
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":1,"items":"x"}') })
  await expect(page.locator('#errors')).toContainText('形式が不正')
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
})

test('登録番号の形式不正で警告が出る', async ({ page }) => {
  await fillBasic(page)
  await page.fill('#regNo', 'T12')
  await expect(page.locator('#warnings')).toContainText('登録番号の形式が不正')
})

test('数値でない単価は警告され、0として扱われる', async ({ page }) => {
  await fillBasic(page)
  await page.fill('[data-row="0"] [data-f="unitPrice"]', 'abc')
  await expect(page.locator('#warnings')).toContainText('単価が数値でないか範囲外です')
  await expect(page.locator('#grand-total')).toHaveText('0円')
})

test('明細を全て削除しても空行が残る', async ({ page }) => {
  await fillBasic(page)
  await page.click('[data-del="0"]')
  await expect(page.locator('.item-row')).toHaveCount(1)
})

test('名前にHTMLタグを入れてもそのまま文字として表示される（XSS）', async ({ page }) => {
  await fillBasic(page)
  await page.fill('#clientName', '<img src=x onerror=window.__xss=1>')
  await expect(page.locator('#sheet img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('横スクロールが発生しない（レイアウト崩れ確認）', async ({ page }) => {
  await fillBasic(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
