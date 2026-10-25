import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillValid(page: Page) {
  await page.fill('#sellerName', '山田デザイン')
  await page.fill('#sellerReg', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('[aria-label="品名 1"]', 'ロゴ制作')
  await page.fill('[aria-label="数量 1"]', '１')
  await page.fill('[aria-label="単価 1"]', '１０，０００')
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await expect(page.getByText('登録不要・オフライン対応')).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFで保存' })).toBeVisible()
})

test('入力すると税率ごとの消費税と合計がプレビューに反映される', async ({ page }) => {
  await page.goto('/')
  await fillValid(page)
  await expect(page.locator('#grand-total')).toHaveText('¥11,000')
  await page.click('#add-row')
  await page.fill('[aria-label="品名 2"]', '書籍')
  await page.fill('[aria-label="単価 2"]', '1000')
  await page.selectOption('[aria-label="税率 2"]', '8')
  await expect(page.locator('#grand-total')).toHaveText('¥12,080')
  await expect(page.locator('.rates')).toContainText('8%対象')
  await expect(page.locator('.doc')).toContainText('※は軽減税率（8%）対象')
  await expect(page.locator('.doc')).toContainText('登録番号: T1234567890123')
})

test('必須項目の不足と不正な登録番号でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#errors')).toContainText('発行者の氏名または名称')
  await fillValid(page)
  await page.fill('#sellerReg', 'T12')
  await expect(page.locator('#errors')).toContainText('登録番号は')
  await page.fill('#sellerReg', '')
  await expect(page.locator('#no-reg-warning')).toContainText('登録番号が未入力')
})

test('CSVがBOM付きUTF-8で日本語ヘッダーを含み、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillValid(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9_-]+\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('請求書番号')
  expect(buf.toString('utf-8')).toContain('ロゴ制作')
})

test('保存→再読み込みで復元でき、バックアップの往復もできる', async ({ page }) => {
  await page.goto('/')
  await fillValid(page)
  await page.click('#save')
  await expect(page.locator('#status')).toContainText('保存しました')
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
  await expect(page.locator('#sellerName')).toHaveValue('山田デザイン')

  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = await (await dl).path()
  await page.click('.del-saved')
  page.once('dialog', (d) => d.accept())
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('まだありません')
  await page.setInputFiles('#import-json', jsonPath!)
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
})
