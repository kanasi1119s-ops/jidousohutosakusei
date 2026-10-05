import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('消費税 納税額比較シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.getByRole('button', { name: '比較する' })).toBeVisible()
  await expect(page.locator('#summary')).toBeVisible()
  await expect(page.locator('#result-body tr')).toHaveCount(4)
})

test('デフォルト入力（2027年分・第5種550万円）で3割特例が最有利になる', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#recommend')).toContainText('3割特例')
  const row = page.locator('#result-body tr', { hasText: '3割特例' })
  await expect(row).toContainText('150,000円')
})

test('年分を2026年に変えると2割特例が選べる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#year', '2026')
  await page.click('button[type="submit"]')
  await expect(page.locator('#recommend')).toContainText('2割特例')
  await expect(page.locator('#result-body tr', { hasText: '2割特例' })).toContainText('100,000円')
})

test('全角数字・カンマ付きの入力を受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10-4', '５，５００，０００')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#result-body tr', { hasText: '3割特例' })).toContainText('150,000円')
})

test('不正な入力（文字列・負数）でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#purchases10', 'abc')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('数値')
  await page.fill('#purchases10', '-5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^consumption-tax-compare-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('方式')
  expect(text).toContain('3割特例')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#baseYearSales', '7,000,000')
  await page.selectOption('#year', '2028')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('consumption-tax-compare-settings.json')
  const jsonPath = (await download.path())!

  await page.fill('#baseYearSales', '1')
  await page.selectOption('#year', '2030')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath)
  await expect(page.locator('#baseYearSales')).toHaveValue('7000000')
  await expect(page.locator('#year')).toHaveValue('2028')
})

test('不正なJSONのインポートはエラー表示で、画面は壊れない', async ({ page }, testInfo) => {
  await page.goto('/')
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{"year": 1999}')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(bad)
  await expect(page.locator('#errors')).toContainText('形式が不正')
  await expect(page.locator('#result-body tr')).toHaveCount(4)
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
})

test('PC幅(1280px)でもレイアウトが崩れない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#purchases8', '123456')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#purchases8')).toHaveValue('123456')
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('消費税 納税額比較シミュレーター')
  await page.fill('#sales10-4', '5500000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#recommend')).toContainText('円')
  await context.setOffline(false)
})

test('外部ドメインへの通信が発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol.startsWith('http')) {
      external.push(req.url())
    }
  })
  await page.goto('/')
  await page.click('button[type="submit"]')
  expect(external).toEqual([])
})
