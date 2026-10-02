import { expect, test } from '@playwright/test'
import fs from 'node:fs'

test('日本語UIが表示され、入力がプレビューと税額に反映される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'インボイス請求書ジェネレーター' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDFとして保存 / 印刷' })).toBeVisible()
  await page.fill('#f-issuer', '山田デザイン')
  await page.fill('#f-reg', 'ｔ１２３４５６７８９０１２３')
  await page.fill('#f-client', '株式会社サンプル')
  await page.getByLabel('品名 1').fill('ロゴ制作')
  await page.getByLabel('単価 1').fill('１０，０００')
  const preview = page.locator('#preview')
  await expect(preview).toContainText('株式会社サンプル 御中')
  await expect(preview).toContainText('登録番号: T1234567890123')
  await expect(preview).toContainText('10%消費税額')
  await expect(preview).toContainText('¥1,000')
  await expect(preview).toContainText('¥11,000')
})

test('軽減税率の明細と源泉徴収', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('単価 1').fill('100000')
  await page.getByRole('button', { name: '＋ 明細を追加' }).click()
  await page.getByLabel('品名 2').fill('お菓子')
  await page.getByLabel('単価 2').fill('1000')
  await page.getByLabel('税率 2').selectOption('8')
  await page.check('#f-withholding')
  // 税抜合計 101,000円 × 10.21% = 10,312円（円未満切り捨て）
  const preview = page.locator('#preview')
  await expect(preview).toContainText('お菓子 ※')
  await expect(preview).toContainText('8%消費税額')
  await expect(preview).toContainText('源泉徴収税額')
  await expect(preview).toContainText('-¥10,312')
})

test('登録番号の形式エラー表示', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-reg', 'T123')
  await expect(page.locator('#reg-warn')).toContainText('13桁')
})

test('再読み込み後に入力が復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', '復元テスト商事')
  await page.reload()
  await expect(page.locator('#f-client')).toHaveValue('復元テスト商事')
})

test('CSVはBOM付きUTF-8・英数字ファイル名、JSON往復', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-number', 'INV-001')
  await page.getByLabel('品名 1').fill('設計費')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-csv')])
  expect(dl.suggestedFilename()).toMatch(/^invoice-INV-001-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('設計費')

  const [jl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-json')])
  const jsonPath = (await jl.path())!
  page.once('dialog', (d) => d.accept())
  await page.click('#btn-clear')
  await expect(page.locator('#f-client')).toHaveValue('')
  await page.setInputFiles('#btn-import', jsonPath)
  await expect(page.getByLabel('品名 1')).toHaveValue('設計費')
})

test('不正なJSONは読み込まずメッセージを表示', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#btn-import', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{oops') })
  await expect(page.locator('#import-msg')).toContainText('読み込めませんでした')
})

test('XSS: 入力したHTMLは文字として表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', '<img src=x onerror=window.__xss=1>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('オフラインでも再読み込みして動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'インボイス請求書ジェネレーター' })).toBeVisible()
  await page.fill('#f-client', 'オフライン商店')
  await expect(page.locator('#preview')).toContainText('オフライン商店 御中')
  await context.setOffline(false)
})

test('スマホ幅で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
