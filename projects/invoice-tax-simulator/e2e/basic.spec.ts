import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('消費税 納税額シミュレーター')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('label[for="taxYear"]')).toHaveText('対象年分（個人事業者・暦年）')
  await expect(page.locator('button[type="submit"]')).toHaveText('試算する')
  await expect(page.locator('#summary')).toBeVisible()
})

test('既定値で3割特例が最有利と表示される', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(4)
  await expect(page.locator('#best-summary')).toContainText('3割特例')
})

test('2026年分を選ぶと2割特例になる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#taxYear', '2026')
  await page.click('button[type="submit"]')
  await expect(page.locator('#best-summary')).toContainText('2割特例')
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
  expect(download.suggestedFilename()).toMatch(/^invoice-tax-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('納付税額(円)')
  expect(text).toContain('原則課税（本則課税）')
  expect(text).not.toContain('�')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '9,999,000')
  await page.selectOption('#businessType', '3')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = (await (await downloadPromise).path())!

  await page.fill('#sales10Yen', '1')
  await page.selectOption('#businessType', '6')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath)
  await expect(page.locator('#sales10Yen')).toHaveValue('9999000')
  await expect(page.locator('#businessType')).toHaveValue('3')
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
})
