import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toHaveText('試算する')
  await expect(page.locator('#summary')).toBeVisible()
})

test('入力すると試算結果が更新され、全角数字も受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyTsumitateYen', '１００，０００')
  await page.fill('#years', '5')
  await page.fill('#annualReturnPct', '0')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(5)
  await expect(page.locator('#totals')).toContainText('6,000,000円')
})

test('枠超過で警告が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyTsumitateYen', '300000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#warnings')).toContainText('年間投資枠')
})

test('不正入力でエラー表示', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '0')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('積立期間')
})

test('CSVがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^nisa-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('経過年数')
})

test('設定JSONの往復と再読み込み後の復元', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '7')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const path = (await (await dl).path())!
  await page.reload()
  await expect(page.locator('#years')).toHaveValue('7')
  await page.fill('#years', '3')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#years')).toHaveValue('7')
})

test('不正なJSONのインポートはエラー表示', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('スマホ幅・PC幅で横スクロールしない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  }
})
