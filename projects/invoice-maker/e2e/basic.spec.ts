import { expect, test } from '@playwright/test'
import fs from 'node:fs'

async function fill(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#registrationNo', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#invoiceNo', 'A-001')
  await page.fill('.item[data-i="0"] [data-f="name"]', 'ロゴ制作')
  await page.fill('.item[data-i="0"] [data-f="quantity"]', '２')
  await page.fill('.item[data-i="0"] [data-f="unitPrice"]', '１０,０００')
}

test('日本語表示と合計計算（全角数字入力）', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '適格請求書ジェネレーター' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDFとして保存／印刷' })).toBeVisible()
  await fill(page)
  await expect(page.locator('#preview')).toContainText('¥22,000')
  await expect(page.locator('#registrationNo')).toHaveValue('T1234567890123')
  await expect(page.locator('#issues')).toBeEmpty()
})

test('必須項目の不足警告', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#issues')).toContainText('登録番号')
})

test('保存→再読み込み後に復元', async ({ page }) => {
  await fill(page)
  await page.click('#save')
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#saved')).toContainText('A-001')
})

test('CSVはBOM付きUTF-8・英数字ファイル名', async ({ page }) => {
  await fill(page)
  await page.fill('#issueDate', '2026-11-03')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csv')])
  expect(dl.suggestedFilename()).toBe('invoice-A-001-2026-11-03.csv')
  const buf = fs.readFileSync((await dl.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('ロゴ制作')
})

test('JSONエクスポート→インポートの往復', async ({ page }) => {
  await fill(page)
  await page.click('#save')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportJson')])
  const path = (await dl.path())!
  await page.click('#new')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved')).toContainText('保存済みの請求書はありません')
  await page.setInputFiles('#importJson', path)
  await expect(page.locator('#saved')).toContainText('株式会社サンプル')
})

test('不正なJSONは安全に拒否される', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#importJson', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
  await expect(page.locator('#msg')).toContainText('失敗')
})

test('HTMLを含む入力はエスケープされる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  await expect(page.locator('#preview')).toContainText('<img src=x')
})

test('オフラインでも動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '適格請求書ジェネレーター' })).toBeVisible()
  await page.fill('#clientName', 'オフライン確認')
  await expect(page.locator('#preview')).toContainText('オフライン確認')
})
