import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '試算する' })).toBeVisible()
  await expect(page.locator('#summary')).toBeVisible()
})

test('入力すると結果と年次表が更新される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyYen', '50000')
  await page.fill('#years', '10')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(10)
  await expect(page.locator('#kpis')).toContainText('6,000,000円')
})

test('年間枠を超える積立で警告が表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyYen', '400000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#warnings')).toContainText('年間投資枠')
})

test('目標金額から必要な月額が逆算される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#goalYen', '20000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#goal-result')).toContainText('毎月の積立額の目安')
})

test('異常な入力でエラーが表示され、修正すると解消される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '0')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('運用期間')
  await page.fill('#years', '5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^nisa-simulation-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('NISA評価額(円)')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyYen', '12345')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = await (await dl).path()
  await page.reload()
  await page.fill('#monthlyYen', '1')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath!)
  await expect(page.locator('#monthlyYen')).toHaveValue('12345')
})

test('不正なJSONのインポートはエラー表示になる', async ({ page }) => {
  await page.goto('/')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"monthlyYen":"abc"}') })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#monthlyYen', '77777')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#monthlyYen')).toHaveValue('77777')
})

for (const width of [375, 1280]) {
  test(`幅${width}pxで横スクロールが発生しない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflow).toBe(false)
  })
}

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('新NISA積立シミュレーター')
  await page.fill('#monthlyYen', '20000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr').first()).toBeVisible()
  await context.setOffline(false)
})

test('運用期間1年でもグラフに終点が描画される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#years', '1')
  await page.click('button[type="submit"]')
  await expect(page.locator('#chart circle')).toHaveCount(1)
})
