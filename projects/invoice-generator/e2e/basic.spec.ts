import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillIssuer(page: Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#issuerReg', 'T1234567890123')
  await page.fill('#issuerAddress', '東京都千代田区1-1-1')
  await page.fill('#issuerBank', '○○銀行 △△支店 普通 1234567')
}
async function fillInvoice(page: Page) {
  await page.fill('#invNumber', '2026-001')
  await page.fill('#invClient', '株式会社テスト商事')
  await page.fill('#invSubject', 'ロゴデザイン制作')
  await page.fill('[data-k="description"][data-i="0"]', 'ロゴデザイン一式')
  await page.fill('[data-k="unitPrice"][data-i="0"]', '１０，０００')
}

test('日本語の見出し・ボタンが正しく表示され、税額が計算される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await expect(page.getByRole('button', { name: '印刷／PDFとして保存' })).toBeVisible()
  await fillIssuer(page)
  await fillInvoice(page)
  const paper = page.locator('#paper')
  await expect(paper).toContainText('ご請求金額（税込）: ¥11,000')
  await expect(paper).toContainText('登録番号: T1234567890123')
  await expect(paper).toContainText('株式会社テスト商事 御中')
  await expect(paper).toContainText('消費税額等（10%）')
})

test('税率10%と8%が区分表示される', async ({ page }) => {
  await page.goto('/')
  await fillIssuer(page)
  await fillInvoice(page)
  await page.click('#add-item')
  await page.fill('[data-k="description"][data-i="1"]', 'お菓子')
  await page.fill('[data-k="unitPrice"][data-i="1"]', '500')
  await page.selectOption('[data-k="taxRate"][data-i="1"]', '8')
  await expect(page.locator('#paper')).toContainText('8%対象（税抜）')
  await expect(page.locator('#paper')).toContainText('ご請求金額（税込）: ¥11,540')
})

test('登録番号が未入力だと保存できず日本語のエラーが出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#invClient', '株式会社テスト商事')
  await page.fill('[data-k="description"][data-i="0"]', 'x')
  await page.click('#save-inv')
  await expect(page.locator('#errors')).toContainText('登録番号')
})

test('保存→再読み込み後に復元される', async ({ page }) => {
  await page.goto('/')
  await fillIssuer(page)
  await fillInvoice(page)
  await page.click('#save-inv')
  await expect(page.locator('#saved-list')).toContainText('株式会社テスト商事')
  await page.reload()
  await expect(page.locator('#issuerName')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#saved-list')).toContainText('2026-001')
  await page.click('[data-open]')
  await expect(page.locator('#invClient')).toHaveValue('株式会社テスト商事')
})

test('CSVはBOM付きUTF-8で英数字のファイル名', async ({ page }) => {
  await page.goto('/')
  await fillIssuer(page)
  await fillInvoice(page)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9._-]+\.csv$/)
  const buf = fs.readFileSync(await dl.path())
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf8')
  expect(text).toContain('株式会社テスト商事')
  expect(text).not.toContain('\uFFFD')
})

test('バックアップのエクスポート→全消去→インポートで往復できる', async ({ page }) => {
  await page.goto('/')
  await fillIssuer(page)
  await fillInvoice(page)
  await page.click('#save-inv')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-json')])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9._-]+\.json$/)
  const file = await dl.path()
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('保存済みの請求書はありません')
  await page.setInputFiles('#import-file', file)
  await expect(page.locator('#io-msg')).toContainText('1件の請求書を読み込みました')
  await expect(page.locator('#saved-list')).toContainText('株式会社テスト商事')
})

test('不正なバックアップファイルは日本語メッセージで拒否される', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2}') })
  await expect(page.locator('#io-msg')).toContainText('バックアップファイルではありません')
  await page.setInputFiles('#import-file', { name: 'bad2.json', mimeType: 'application/json', buffer: Buffer.from('not json') })
  await expect(page.locator('#io-msg')).toContainText('JSONとして読み込めません')
})

test('HTMLを含む入力がスクリプトとして実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#invClient', '<img src=x onerror="window.__xss=1">')
  await page.fill('#invSubject', '<b>太字</b>')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('#paper b')).toHaveCount(0)
  await expect(page.locator('#paper')).toContainText('<b>太字</b>')
})

test('オフラインでも再読み込みして動作する', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'chromiumのみ')
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await page.fill('[data-k="unitPrice"][data-i="0"]', '1000')
  await expect(page.locator('#paper')).toContainText('¥1,100')
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
