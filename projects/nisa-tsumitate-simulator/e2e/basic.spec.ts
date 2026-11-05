import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとバッジが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.getByRole('button', { name: '試算する' })).toBeVisible()
  await expect(page.locator('#summary')).toBeVisible()
})

test('全角数字でも試算でき、年数分の行が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#tsumitateMonthlyYen', '５０，０００')
  await page.fill('#years', '10')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(10)
  await expect(page.locator('#cards')).toContainText('6,000,000円')
})

test('上限超過でエラー、負数でもエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#tsumitateMonthlyYen', '150000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('120万円')
  await page.fill('#tsumitateMonthlyYen', '-1')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
})

test('生涯枠到達の注意表示', async ({ page }) => {
  await page.goto('/')
  await page.fill('#tsumitateMonthlyYen', '100000')
  await page.fill('#growthMonthlyYen', '100000')
  await page.fill('#years', '30')
  await page.click('button[type="submit"]')
  await expect(page.locator('#cap-notice')).toContainText('1,800万円')
})

test('設定が再読み込み後に復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '15')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#years')).toHaveValue('15')
})

test('CSVはBOM付きUTF-8・英数字ファイル名・日本語ヘッダー', async ({ page }) => {
  await page.goto('/')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^nisa-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('経過年数')
})

test('JSONエクスポート→インポートの往復', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '7')
  await page.fill('#annualReturnPercent', '4.5')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const d = await dl
  const p = (await d.path())!
  await page.fill('#years', '30')
  await page.setInputFiles('#import-file', p)
  await expect(page.locator('#years')).toHaveValue('7')
  await expect(page.locator('#annualReturnPercent')).toHaveValue('4.5')
})

test('不正なJSONのインポートはエラー表示', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"years":"x"}', 'utf8'),
  })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('ネットワーク遮断後も動作する（オフライン）', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await page.fill('#years', '5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(5)
})

test('モバイル幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const w = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(w).toBeLessThanOrEqual(375)
})
