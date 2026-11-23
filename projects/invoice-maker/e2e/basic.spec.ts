import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function createInvoice(page: Page, customer = '株式会社サンプル') {
  await page.fill('#issuer-name', '山田 太郎')
  await page.fill('#issuer-regno', 'T1234567890123')
  await page.click('#btn-new')
  await page.fill('#inv-customer', customer)
  await page.fill('.in-name >> nth=0', 'ウェブ制作')
  await page.fill('.in-qty >> nth=0', '2')
  await page.fill('.in-price >> nth=0', '10000')
}

test('日本語の見出しとボタンが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await expect(page.locator('#btn-new')).toHaveText('新しい請求書を作る')
  await expect(page.getByText('登録不要')).toBeVisible()
})

test('明細を入力すると税率別に計算され、プレビューに登録番号が出る', async ({ page }) => {
  await page.goto('/')
  await createInvoice(page)
  await page.click('#btn-add-item')
  await page.fill('.in-name >> nth=1', '飲料')
  await page.fill('.in-qty >> nth=1', '３')
  await page.fill('.in-price >> nth=1', '１，０００')
  await page.selectOption('.in-rate >> nth=1', '8')
  await expect(page.locator('#totals')).toContainText('10%対象: 税抜 ¥20,000 ／ 消費税 ¥2,000')
  await expect(page.locator('#totals')).toContainText('8%対象: 税抜 ¥3,000 ／ 消費税 ¥240')
  await expect(page.locator('#totals .grand')).toContainText('¥25,240')
  await expect(page.locator('#sheet')).toContainText('登録番号: T1234567890123')
  await expect(page.locator('#sheet')).toContainText('株式会社サンプル 御中')
  await expect(page.locator('#sheet')).toContainText('※は軽減税率')
})

test('保存→再読み込み後も復元される', async ({ page }) => {
  await page.goto('/')
  await createInvoice(page)
  await page.click('#btn-save')
  await expect(page.locator('#list-body')).toContainText('株式会社サンプル')
  await page.reload()
  await expect(page.locator('#list-body')).toContainText('株式会社サンプル')
  await expect(page.locator('#issuer-name')).toHaveValue('山田 太郎')
})

test('必須項目が空だと保存できずエラーが出る', async ({ page }) => {
  await page.goto('/')
  await page.click('#btn-new')
  await page.click('#btn-save')
  await expect(page.locator('#edit-errors')).toContainText('宛先を入力してください')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名は英数字', async ({ page }) => {
  await page.goto('/')
  await createInvoice(page)
  await page.click('#btn-save')
  const dl = page.waitForEvent('download')
  await page.click('#btn-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^invoice-list-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('株式会社サンプル')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('バックアップのエクスポート→全消去→インポートで往復できる', async ({ page }) => {
  await page.goto('/')
  await createInvoice(page, '往復テスト商事')
  await page.click('#btn-save')
  const dl = page.waitForEvent('download')
  await page.click('#btn-backup')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^invoice-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await d.path())!
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#list-body')).not.toContainText('往復テスト商事')
  page.once('dialog', (x) => x.accept())
  await page.setInputFiles('#file-import', path)
  await expect(page.locator('#list-body')).toContainText('往復テスト商事')
  await expect(page.locator('#issuer-name')).toHaveValue('山田 太郎')
})

test('不正なファイルのインポートは拒否される', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#file-import', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.locator('#list-msg')).toContainText('読み込めませんでした')
})

test('HTMLを含む入力がスクリプトとして実行されない(XSS)', async ({ page }) => {
  await page.goto('/')
  let dialogs = 0
  page.on('dialog', (d) => { dialogs++; void d.dismiss() })
  await createInvoice(page, '<img src=x onerror=alert(1)>')
  await page.click('#btn-save')
  await expect(page.locator('#sheet')).toContainText('<img src=x onerror=alert(1)>')
  expect(await page.locator('#sheet img').count()).toBe(0)
  expect(dialogs).toBe(0)
})

test('登録番号が未入力だと警告が出る', async ({ page }) => {
  await page.goto('/')
  await page.click('#btn-new')
  await expect(page.locator('#sheet-warn')).toContainText('登録番号')
})

test('横スクロールが発生しない', async ({ page }) => {
  await page.goto('/')
  await createInvoice(page)
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(over).toBe(false)
})
