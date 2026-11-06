import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function fillBasic(page: import('@playwright/test').Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#registrationNumber', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#clientName', '株式会社サンプル')
  await page.locator('.item-name').first().fill('ロゴ制作費')
  await page.locator('.item-price').first().fill('１００,０００')
}

test('日本語の見出しとプレビューが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー（インボイス対応）')
  await expect(page.getByRole('button', { name: '印刷 / PDFとして保存' })).toBeVisible()
  await expect(page.locator('#preview h2')).toHaveText('請求書')
})

test('入力が請求書プレビューと税額計算に反映される（全角数字対応）', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await expect(page.locator('#pv-client')).toHaveText('株式会社サンプル 御中')
  await expect(page.locator('#pv-reg')).toHaveText('登録番号: T1234567890123')
  await expect(page.locator('#pv-total')).toContainText('110,000円')
})

test('軽減税率を混在させると税率ごとに区分表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  await page.locator('.item-name').nth(1).fill('お菓子')
  await page.locator('.item-price').nth(1).fill('1000')
  await page.locator('.item-rate').nth(1).selectOption('8')
  await expect(page.locator('table.rates tbody tr')).toHaveCount(2)
  await expect(page.locator('#pv-total')).toContainText('111,080円')
})

test('登録番号が不正だと警告が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#registrationNumber', '12345')
  await expect(page.locator('#warnings')).toContainText('登録番号')
})

test('再読み込み後も入力が復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#pv-total')).toContainText('110,000円')
})

test('CSVはBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9_-]+\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('品名,数量')
  expect(text).toContain('ロゴ制作費')
  expect(text).not.toContain('\ufffd')
})

test('JSON書き出し→読み込みの往復で内容が復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'im-')), 'backup.json')
  await download.saveAs(file)
  await page.fill('#clientName', '')
  await page.setInputFiles('#import-file', file)
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#import-msg')).toContainText('読み込みました')
})
