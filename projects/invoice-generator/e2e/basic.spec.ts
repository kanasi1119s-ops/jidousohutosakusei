import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { fillBasicInvoice } from './helpers'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.getByRole('button', { name: '請求書を保存' })).toBeVisible()
  await expect(page.locator('#sheet h3')).toHaveText('請求書')
})

test('全角数字で入力しても税込金額が計算される', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await expect(page.locator('#sheet')).toContainText('ご請求金額: ¥11,000')
  await expect(page.locator('#sheet')).toContainText('登録番号: T1234567890123')
  await expect(page.locator('#sheet')).toContainText('株式会社サンプル 御中')
})

test('軽減税率と源泉徴収が反映される', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.click('#add-row')
  const row2 = page.locator('#item-rows tr').nth(1)
  await row2.locator('.r-name').fill('お菓子')
  await row2.locator('.r-price').fill('1000')
  await row2.locator('.r-rate').selectOption('8')
  await expect(page.locator('#sheet')).toContainText('※ お菓子')
  await page.check('#inv-withholding')
  // 税抜 11,000 → 源泉 1,123、消費税 1,000 + 80 → 請求 11,000+1,080-1,123 = 10,957
  await expect(page.locator('#sheet')).toContainText('ご請求金額: ¥10,957')
})

test('必須項目が不足していると出力できない', async ({ page }) => {
  await page.goto('/')
  await page.click('#export-csv')
  await expect(page.locator('#errors')).toContainText('登録番号')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-[A-Za-z0-9_-]+\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('ロゴ制作')
  expect(text).not.toContain('�')
})

test('保存して再読み込みしても復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.click('#save')
  await expect(page.locator('#status')).toContainText('保存しました')
  await page.reload()
  await expect(page.locator('#issuer-name')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#saved-list li')).toHaveCount(1)
  await page.locator('#saved-list li button', { hasText: '開く' }).click()
  await expect(page.locator('#inv-client')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#sheet')).toContainText('ご請求金額: ¥11,000')
})

test('JSONの書き出しと読み込みを往復できる', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.click('#save')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-generator-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved-list li')).toHaveCount(0)
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#status')).toContainText('1件')
  await expect(page.locator('#issuer-name')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
})

test('印刷レイアウトでは請求書だけが表示されPDF化できる', async ({ page, browserName }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#sheet')).toBeVisible()
  await expect(page.locator('#issuer-name')).toBeHidden()
  if (browserName === 'chromium') {
    const pdf = await page.pdf({ format: 'A4' })
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  }
})
