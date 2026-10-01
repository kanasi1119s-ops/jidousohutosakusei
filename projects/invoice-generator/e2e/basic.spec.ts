import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function fillFirstItem(page: import('@playwright/test').Page, name: string, qty: string, price: string) {
  const row = page.locator('#items .item-row').first()
  await row.locator('.item-name').fill(name)
  await row.locator('.item-qty').fill(qty)
  await row.locator('.item-price').fill(price)
}

test('日本語の見出し・ラベルが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await expect(page.getByText('登録不要・オフライン対応')).toBeVisible()
  await expect(page.locator('#preview .pv-title')).toHaveText('請求書')
  await expect(page.getByRole('button', { name: '印刷 / PDFとして保存' })).toBeVisible()
})

test('明細を入力すると税率ごとの合計が計算される', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, 'デザイン費', '2', '5000')
  await expect(page.locator('#pv-total')).toHaveText('¥11,000')
  await page.click('#add-item')
  const row2 = page.locator('#items .item-row').nth(1)
  await row2.locator('.item-name').fill('書籍')
  await row2.locator('.item-qty').fill('1')
  await row2.locator('.item-price').fill('1000')
  await row2.locator('.item-rate').selectOption('8')
  await expect(page.locator('#pv-total')).toHaveText('¥12,080')
  await expect(page.locator('#preview')).toContainText('※は軽減税率（8%）対象です。')
  await expect(page.locator('.pv-groups tbody tr')).toHaveCount(2)
})

test('全角数字・カンマで入力しても計算できる', async ({ page }) => {
  await page.goto('/')
  await fillFirstItem(page, '作業費', '１', '１２，３４５')
  await expect(page.locator('#pv-total')).toHaveText('¥13,579')
})

test('登録番号の形式が不正なとき警告が表示され、正しければ消える', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#pv-reg-warning')).toContainText('適格請求書')
  await page.fill('#issuer-reg', 'T123')
  await expect(page.locator('#reg-hint')).toContainText('形式が正しくありません')
  await page.fill('#issuer-reg', 'ｔ１２３４５６７８９０１２３')
  await expect(page.locator('#pv-reg-warning')).toHaveText('')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
})

test('CSVエクスポートがBOM付きUTF-8で日本語を含み、ファイル名が英数字のみ', async ({ page }) => {
  await page.goto('/')
  await page.fill('#inv-number', '請求書-INV001')
  await fillFirstItem(page, 'ウェブ制作', '1', '30000')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('品名')
  expect(text).toContain('ウェブ制作,1,30000,10%,30000')
  expect(text).not.toContain('�')
})

test('保存→JSONバックアップ→全削除→インポートで往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#client-name', '株式会社サンプル')
  await page.fill('#inv-number', 'A-001')
  await fillFirstItem(page, '保守費用', '3', '10000')
  await page.click('#save-btn')
  await expect(page.locator('#saved-list li button.saved-open')).toContainText('A-001')

  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-generator-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const jsonPath = (await download.path())!

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#client-name')).toHaveValue('')

  await page.setInputFiles('#import-json', jsonPath)
  await expect(page.locator('#message')).toContainText('1件の請求書を読み込みました')
  await expect(page.locator('#client-name')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#pv-total')).toHaveText('¥33,000')
})

test('印刷ボタンでprintが呼ばれ、印刷時は入力フォームが非表示になる', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __printed: number }).__printed = 0
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed++
    }
  })
  await page.click('#print-btn')
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.panel')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})
