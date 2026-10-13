import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しと結果が表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#result-body tr')).toHaveCount(20)
  await expect(page.locator('#final-value')).toContainText('評価額の目安')
})

test('全角数字で入力でき、年数に応じて行数が変わる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '５')
  await page.fill('#monthlyTsumitateYen', '３００００')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(5)
})

test('上限超過でエラー表示', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyTsumitateYen', '200000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('年120万円')
})

test('リロード後に入力が復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '7')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#years')).toHaveValue('7')
})

test('CSVはBOM付きUTF-8', async ({ page }) => {
  await page.goto('/')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^nisa-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('経過年')
})

test('JSONエクスポート→インポートの往復', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '12')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const d = await dl
  const path = (await d.path())!
  await page.fill('#years', '3')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#years')).toHaveValue('12')
})

test('オフラインでも再読み込みで動作する', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium')
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await context.setOffline(false)
})
