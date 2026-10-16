import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page): Promise<void> {
  await page.fill('#f-client', '株式会社テスト')
  await page.fill('[data-k="description"]', 'ウェブサイト制作')
  await page.fill('[data-k="quantity"]', '1')
  await page.fill('[data-k="unitPrice"]', '100000')
}

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('#btn-save')).toHaveText('保存')
  await expect(page.locator('#btn-print')).toHaveText('PDFで保存・印刷')
  await expect(page.locator('#edit-title')).toHaveText('請求書の内容')
})

test('入力するとプレビューに税率ごとの消費税額が反映される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await expect(page.locator('#preview')).toContainText('株式会社テスト 御中')
  await expect(page.locator('#preview .inv-total')).toContainText('¥110,000')
  await expect(page.locator('#preview .inv-groups')).toContainText('10%対象')
  await expect(page.locator('#preview .inv-groups')).toContainText('¥10,000')
})

test('税込入力・軽減税率・複数行で端数処理が税率ごとに1回になる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', 'A社')
  await page.selectOption('#f-mode', 'inclusive')
  await page.fill('[data-k="description"]', '商品A')
  await page.fill('[data-k="unitPrice"]', '60000')
  await page.click('#add-line')
  const row2 = page.locator('#lines-body tr').nth(1)
  await row2.locator('[data-k="description"]').fill('食品B')
  await row2.locator('[data-k="unitPrice"]').fill('40000')
  await row2.locator('[data-k="taxRate"]').selectOption('8')
  const groups = page.locator('#preview .inv-groups')
  await expect(groups).toContainText('¥5,454')
  await expect(groups).toContainText('¥2,962')
  await expect(page.locator('#preview')).toContainText('食品B※')
})

test('保存→再読み込み後も保存済み一覧と下書きが復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-number', 'INV-TEST-001')
  await fillBasic(page)
  await page.click('#btn-save')
  await expect(page.locator('#status')).toHaveText('保存しました。')
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('INV-TEST-001')
  await expect(page.locator('#saved-list')).toContainText('株式会社テスト')
  await expect(page.locator('#f-client')).toHaveValue('株式会社テスト')
})

test('必須項目が未入力だと保存できずエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.click('#btn-save')
  await expect(page.locator('#errors')).toContainText('請求先名を入力してください')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名が英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#btn-save')
  const dl = page.waitForEvent('download')
  await page.click('#btn-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('請求書番号')
  expect(text).toContain('ウェブサイト制作')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('バックアップ(JSON)の書き出し→削除→読み込みで復元できる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#issuer-card summary').click()
  await page.fill('#i-name', '山田太郎')
  await fillBasic(page)
  await page.click('#btn-save')
  const dl = page.waitForEvent('download')
  await page.click('#btn-export')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!
  const json = JSON.parse(fs.readFileSync(path, 'utf-8'))
  expect(json.invoices[0].clientName).toBe('株式会社テスト')
  expect(json.issuer.name).toBe('山田太郎')

  page.once('dialog', (d) => d.accept())
  await page.locator('#saved-list li button', { hasText: '削除' }).click()
  await expect(page.locator('#saved-empty')).toBeVisible()

  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#saved-list')).toContainText('株式会社テスト')
  await expect(page.locator('#status')).toContainText('1件')
})

test('不正なファイルのインポートはエラーを表示しデータを壊さない', async ({ page }, testInfo) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#btn-save')
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{"hello": 1}')
  await page.setInputFiles('#import-file', bad)
  await expect(page.locator('#errors')).toContainText('バックアップファイルではありません')
  await expect(page.locator('#saved-list li')).toHaveCount(1)
})

test('印刷表示ではプレビューの請求書だけが表示され、フォームは隠れる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.screen-only')).toBeHidden()
  await expect(page.locator('#print-area')).toBeVisible()
  await expect(page.locator('#print-area')).toContainText('請求書')
  await expect(page.locator('#print-area')).toContainText('株式会社テスト 御中')
  const pdf = await page.pdf({ format: 'A4' })
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
})

test('PDF保存ボタンは入力エラーがあれば印刷せず、正常なら window.print を呼ぶ', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __printed: number }).__printed = 0
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed++
    }
  })
  await page.goto('/')
  await page.click('#btn-print')
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(0)
  await fillBasic(page)
  await page.click('#btn-print')
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)
})
