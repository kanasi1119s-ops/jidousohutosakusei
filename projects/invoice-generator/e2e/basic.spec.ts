import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page): Promise<void> {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#issuerReg', 'T1234567890123')
  await page.fill('#invNumber', 'INV-001')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#issueDate', '2026-11-16')
  const row = page.locator('#items .item').first()
  await row.locator('[data-f="name"]').fill('ロゴ制作')
  await row.locator('[data-f="quantity"]').fill('1')
  await row.locator('[data-f="unit"]').fill('100000')
}

test('日本語の見出しとプレビューが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書ジェネレーター')
  await expect(page.getByRole('button', { name: '印刷 / PDF保存' })).toBeVisible()
  await fillBasic(page)
  const pv = page.locator('#preview')
  await expect(pv.locator('h2')).toHaveText('請求書')
  await expect(pv).toContainText('株式会社サンプル 御中')
  await expect(pv).toContainText('ご請求金額 ¥110,000（税込）')
  await expect(pv).toContainText('登録番号: T1234567890123')
})

test('全角数字で入力しても計算できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const row = page.locator('#items .item').first()
  await row.locator('[data-f="quantity"]').fill('２')
  await row.locator('[data-f="unit"]').fill('１，０００')
  await expect(page.locator('#preview')).toContainText('ご請求金額 ¥2,200（税込）')
})

test('入力エラーが表示されプレビューが止まる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerReg', 'T123')
  await expect(page.locator('#error-list')).toContainText('登録番号は「T」＋数字13桁')
  await expect(page.locator('#preview')).toContainText('入力内容を確認してください')
})

test('源泉徴収を差し引ける', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.check('#withholding')
  await expect(page.locator('#preview')).toContainText('ご請求金額 ¥99,790（税込）')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toBe('invoice-INV-001-2026-11-16.csv')
  const buf = fs.readFileSync((await download.path())!)
  expect(Array.from(buf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('ロゴ制作')
})

test('保存→再読み込みで復元され、JSONの書き出し→読み込みの往復ができる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  await expect(page.locator('#status')).toHaveText('保存しました。')
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#saved-list li')).toHaveCount(1)

  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-generator-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!
  expect(fs.readFileSync(path, 'utf-8')).toContain('山田デザイン事務所')

  page.on('dialog', (d) => d.accept())
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved-list li')).toHaveText('保存済みの請求書はまだありません。')
  await page.setInputFiles('#import-json', path)
  await expect(page.locator('#saved-list li')).toHaveCount(1)
  await expect(page.locator('#issuerName')).toHaveValue('山田デザイン事務所')
})

test('不正なJSONの読み込みはエラー表示で既存データを壊さない', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.setInputFiles('#import-json', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('これはJSONではありません', 'utf-8'),
  })
  await expect(page.locator('#status')).toContainText('読み込みに失敗しました')
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
})

test('ユーザー入力がHTMLとして解釈されない（XSS）', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.fill('#clientName', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('横スクロールが発生しない（スマホ幅375px）', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await fillBasic(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('16進・指数表記・空の数量は入力エラーになる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const row = page.locator('#items .item').first()
  for (const bad of ['0x10', '1e3', '', 'abc']) {
    await row.locator('[data-f="quantity"]').fill(bad)
    await expect(page.locator('#error-list')).toContainText('数量は0以外の数値')
  }
})

test('明細を追加・削除でき、12行でも合計が正しい', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  for (let i = 0; i < 11; i++) await page.click('#add-item')
  const rows = page.locator('#items .item')
  await expect(rows).toHaveCount(12)
  for (let i = 1; i < 12; i++) {
    await rows.nth(i).locator('[data-f="name"]').fill('項目' + i)
    await rows.nth(i).locator('[data-f="unit"]').fill('1000')
  }
  await expect(page.locator('#preview')).toContainText('ご請求金額 ¥122,100（税込）')
  await rows.nth(11).locator('[data-f="remove"]').click()
  await expect(rows).toHaveCount(11)
  await expect(page.locator('#preview')).toContainText('ご請求金額 ¥121,000（税込）')
})

test('軽減税率8%と10%が混在する場合に税率ごとに集計される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  const r2 = page.locator('#items .item').nth(1)
  await r2.locator('[data-f="name"]').fill('お弁当')
  await r2.locator('[data-f="unit"]').fill('1000')
  await r2.locator('[data-f="rate"]').selectOption('8')
  const pv = page.locator('#preview')
  await expect(pv).toContainText('8%対象 消費税')
  await expect(pv).toContainText('ご請求金額 ¥111,080（税込）')
  await expect(pv).toContainText('※ お弁当')
})
