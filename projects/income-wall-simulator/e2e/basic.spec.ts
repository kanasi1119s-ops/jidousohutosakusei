import { test, expect } from '@playwright/test'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('年収の壁シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#summary')).toBeVisible()
})

test('入力すると試算結果が更新される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hourlyWageYen', '1500')
  await page.fill('#hoursPerWeek', '25')
  await page.fill('#weeksPerMonth', '4.345')
  await page.fill('#otherAnnualIncomeYen', '0')
  await page.click('button[type="submit"]')

  await expect(page.locator('#annual-income')).toContainText('想定年収')
  await expect(page.locator('#result-body tr')).toHaveCount(6)
})

test('異常な入力（負の週労働時間）でエラーメッセージが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hoursPerWeek', '-5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')

  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^income-wall-simulation-\d{4}-\d{2}-\d{2}\.csv$/)

  const csvPath = await download.path()
  const fs = await import('node:fs')
  const buf = fs.readFileSync(csvPath!)
  expect(buf[0]).toBe(0xef)
  expect(buf[1]).toBe(0xbb)
  expect(buf[2]).toBe(0xbf)
  const text = buf.toString('utf-8')
  expect(text).toContain('しきい値名')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hourlyWageYen', '1300')
  await page.click('button[type="submit"]')

  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  const jsonPath = await download.path()

  await page.reload()
  await page.fill('#hourlyWageYen', '999')

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#import-json'),
  ])
  await fileChooser.setFiles(jsonPath!)

  await expect(page.locator('#hourlyWageYen')).toHaveValue('1300')
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalScroll).toBe(false)
})
