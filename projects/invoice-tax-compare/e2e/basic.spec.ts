import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス特例 納税額比較')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toHaveText('比較する')
  await expect(page.locator('#summary')).toBeVisible()
})

test('初期値では2割特例が最小として表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#best-method')).toContainText('2割特例')
  await expect(page.locator('#result-body tr')).toHaveCount(4)
  await expect(page.locator('#result-body tr.best')).toContainText('100,000円')
})

test('令和9年分に切り替えると2割特例は不可・3割特例が可になる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#taxYear', '2027')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr', { hasText: '2割特例' })).toContainText('不可')
  await expect(page.locator('#best-method')).toContainText('3割特例')
})

test('売上を変更して再計算できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '3000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#result-body tr.best')).toContainText('60,000円')
})

test('異常な入力（負の売上）でエラーメッセージが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '-5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-tax-compare-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect(buf[0]).toBe(0xef)
  expect(buf[1]).toBe(0xbb)
  expect(buf[2]).toBe(0xbf)
  expect(buf.toString('utf-8')).toContain('方式')
  expect(buf.toString('utf-8')).not.toContain('�')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '4321000')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('invoice-tax-compare-settings.json')
  const path = (await download.path())!

  await page.fill('#sales10Yen', '1')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#sales10Yen')).toHaveValue('4321000')
})

test('不正なJSONのインポートはエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})
