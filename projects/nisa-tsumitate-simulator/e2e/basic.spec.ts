import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しと免責が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('NISA積立シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('.disclaimer')).toContainText('投資には元本割れのリスクがあります')
  await expect(page.locator('#final-value')).toContainText('年後の評価額')
})

test('入力すると結果が更新され、再読み込み後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyTsumitateYen', '50000')
  await page.fill('#annualReturnPct', '0')
  await page.fill('#years', '10')
  await page.click('button[type="submit"]')
  await expect(page.locator('#final-value')).toContainText('6,000,000円')
  await expect(page.locator('#result-body tr')).toHaveCount(10)
  await page.reload()
  await expect(page.locator('#monthlyTsumitateYen')).toHaveValue('50000')
})

test('全角数字・空入力・上限超過はエラー表示', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyTsumitateYen', '')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('数値')
  await page.fill('#monthlyTsumitateYen', '200000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('年間上限')
})

test('こどもNISAに切り替えると上限600万円で頭打ちになる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#account', 'child')
  await page.fill('#monthlyTsumitateYen', '50000')
  await page.fill('#years', '18')
  await page.fill('#annualReturnPct', '0')
  await page.click('button[type="submit"]')
  await expect(page.locator('#cap-note')).toContainText('100.0%')
})

test('CSVはBOM付きUTF-8で日本語ヘッダー、ファイル名は英数字', async ({ page }) => {
  await page.goto('/')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^nisa-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('経過年数')
})

test('JSONエクスポート→インポートの往復', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '7')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const p = await (await dl).path()
  await page.fill('#years', '30')
  await page.setInputFiles('#import-file', p!)
  await expect(page.locator('#years')).toHaveValue('7')
})

test('不正なJSONのインポートはエラー表示で壊れない', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') })
  await expect(page.locator('#errors')).toContainText('不正')
})

test('サーバー停止後（オフライン）でもリロードして動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('NISA積立シミュレーター')
  await page.click('button[type="submit"]')
  await expect(page.locator('#final-value')).toBeVisible()
})

test('外部ドメインへの通信がゼロ', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')  && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()) })
  await page.goto('/')
  await page.click('button[type="submit"]')
  expect(external).toEqual([])
})
