import { expect, test } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: import('@playwright/test').Page) {
  await page.fill('#issuerName', '山田デザイン事務所')
  await page.fill('#issuerReg', 'T7000012050002')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#docNumber', '2026-001')
  await page.locator('.li-desc').first().fill('ロゴ制作')
  await page.locator('.li-price').first().fill('１０，０００')
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFで保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: '明細をCSVで保存' })).toBeVisible()
})

test('入力すると税額と合計が計算され、要件チェックがすべてOKになる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await expect(page.locator('#sum-body')).toContainText('11,000円')
  await expect(page.locator('#sum-body')).toContainText('1,000円')
  await expect(page.locator('#checklist li.ng')).toHaveCount(0)
  await expect(page.locator('#preview')).toContainText('株式会社サンプル 御中')
  await expect(page.locator('#preview')).toContainText('登録番号: T7000012050002')
})

test('必須項目が空なら要件チェックにNGが表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#checklist li.ng').first()).toBeVisible()
  await expect(page.locator('[data-check="registration"]')).toHaveClass(/ng/)
})

test('8%行には※が付き、税率別の内訳が出る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-line')
  await page.locator('.li-desc').nth(1).fill('お弁当')
  await page.locator('.li-price').nth(1).fill('1000')
  await page.locator('.li-rate').nth(1).selectOption('8')
  await expect(page.locator('#preview')).toContainText('お弁当 ※')
  await expect(page.locator('#sum-body')).toContainText('8% 消費税額')
})

test('不正な単価でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.locator('.li-desc').first().fill('x')
  await page.locator('.li-price').first().fill('abc')
  await expect(page.locator('#errors')).toContainText('単価は数値')
})

test('源泉徴収を有効にすると差引請求額が表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.check('#withholding')
  await expect(page.locator('#sum-body')).toContainText('源泉徴収税額')
  await expect(page.locator('#sum-body')).toContainText('-1,021円')
})

test('CSVエクスポートがBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-items-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path()) as string)
  expect(Array.from(buf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('品名,数量,単価(円)')
  expect(text).toContain('ロゴ制作')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('保存→再読み込みで下書きと保存済み書類が復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-doc')
  await expect(page.locator('#status')).toContainText('保存しました')
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#issuerName')).toHaveValue('山田デザイン事務所')
  await expect(page.locator('#saved-list li')).toContainText('2026-001')
})

test('バックアップのエクスポート→インポートで往復できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-doc')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-maker-data-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path()) as string

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('')
  page.once('dialog', (d) => d.accept())
  await page.setInputFiles('#import-json', path)
  await expect(page.locator('#status')).toContainText('読み込みました')
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#saved-list li')).toContainText('株式会社サンプル')
})

test('壊れたJSONの取り込みはエラーになりデータを変えない', async ({ page }, testInfo) => {
  await page.goto('/')
  await fillBasic(page)
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{"version": 9}')
  await page.setInputFiles('#import-json', bad)
  await expect(page.locator('#status')).toContainText('読み込めませんでした')
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
})

test('HTMLを含む入力が実行されず文字として表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#preview')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('#preview img')).toHaveCount(0)
})
