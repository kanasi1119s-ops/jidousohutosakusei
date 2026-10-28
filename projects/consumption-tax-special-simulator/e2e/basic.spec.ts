import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('消費税 特例比較シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.getByRole('button', { name: '比較する' })).toBeVisible()
  await expect(page.locator('#result-body tr')).toHaveCount(4)
})

test('既定値(2027年)では3割特例が最も有利と表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#headline')).toContainText('3割特例')
  await expect(page.locator('.best-row')).toContainText('150,000円')
})

test('対象年を2026年にすると2割特例が選ばれる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#year', '2026')
  await page.click('button[type="submit"]')
  await expect(page.locator('#headline')).toContainText('2割特例')
})

test('全角数字・カンマ付きの入力を受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salesStandardYen', '５，５００，０００')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#result-body')).toContainText('500,000円')
})

test('不正な入力でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salesStandardYen', '-5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
  await page.fill('#salesStandardYen', 'abc')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('数値')
})

test('巨大な入力値でもクラッシュしない／上限超過はエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salesStandardYen', '99999999999')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await page.fill('#salesStandardYen', '999999999999999')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('大きすぎ')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^consumption-tax-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('納付税額(円)')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salesStandardYen', '3300000')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('consumption-tax-simulator-settings.json')
  const jsonPath = await download.path()

  await page.fill('#salesStandardYen', '1')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath!)
  await expect(page.locator('#salesStandardYen')).toHaveValue('3300000')
})

test('不正なJSONのインポートはエラー表示で状態を壊さない', async ({ page }, testInfo) => {
  await page.goto('/')
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{"year": 1}')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(bad)
  await expect(page.locator('#errors')).toContainText('不正')
  await expect(page.locator('#salesStandardYen')).toHaveValue('5500000')
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salesStandardYen', '4400000')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#salesStandardYen')).toHaveValue('4400000')
})

test('スマホ幅(375px)・PC幅(1280px)で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow, `width=${width}`).toBe(false)
  }
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('消費税 特例比較シミュレーター')
  await page.fill('#salesStandardYen', '2200000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body')).toContainText('200,000円')
  await context.setOffline(false)
})
