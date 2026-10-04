import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillFirstItem(page: Page, desc: string, qty: string, price: string) {
  await page.getByLabel('品目 1').fill(desc)
  await page.getByLabel('数量 1').fill(qty)
  await page.getByLabel('単価 1').fill(price)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: '請求書ジェネレーター' })).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFで保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: '明細CSV' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(String.fromCharCode(0xfffd))
})

test('入力に応じて税額・合計がプレビューに反映される', async ({ page }) => {
  await page.getByLabel('氏名・屋号・会社名').fill('山田デザイン事務所')
  await page.getByLabel('請求先名').fill('株式会社サンプル')
  await fillFirstItem(page, 'Webサイト制作費', '1', '100000')
  const preview = page.locator('#preview')
  await expect(preview).toContainText('山田デザイン事務所')
  await expect(preview).toContainText('株式会社サンプル 御中')
  await expect(preview).toContainText('10%対象 消費税額')
  await expect(page.locator('#grand-total')).toHaveText('¥110,000')
})

test('軽減税率（8%）を混在させると税率ごとに区分表示される', async ({ page }) => {
  await fillFirstItem(page, '制作費', '1', '100000')
  await page.getByRole('button', { name: '＋ 明細を追加' }).click()
  await page.getByLabel('品目 2').fill('飲料')
  await page.getByLabel('数量 2').fill('10')
  await page.getByLabel('単価 2').fill('108')
  await page.getByLabel('税率 2').selectOption('8')
  const preview = page.locator('#preview')
  await expect(preview).toContainText('8%対象 小計（税抜）')
  await expect(preview).toContainText('※は軽減税率（8%）対象')
  await expect(page.locator('#grand-total')).toHaveText('¥111,166')
})

test('源泉徴収を差し引ける', async ({ page }) => {
  await fillFirstItem(page, '原稿料', '1', '100000')
  await page.getByLabel('報酬の源泉徴収を差し引く（目安）').check()
  await expect(page.locator('#preview')).toContainText('-¥10,210')
  await expect(page.locator('#grand-total')).toHaveText('¥99,790')
})

test('登録番号の警告が状況に応じて出る', async ({ page }) => {
  const warn = page.locator('#reg-warn')
  await expect(warn).toContainText('登録番号が未入力')
  await page.getByLabel('適格請求書発行事業者の登録番号').fill('T123')
  await expect(warn).toContainText('形式が正しくありません')
  await page.getByLabel('適格請求書発行事業者の登録番号').fill('Ｔ１２３４５６７８９０１２３')
  await page.getByLabel('適格請求書発行事業者の登録番号').blur()
  await expect(warn).toHaveText('')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
})

test('明細CSVは先頭がBOM(EF BB BF)で、ファイル名は英数字のみ', async ({ page }) => {
  await page.getByLabel('請求書番号').fill('2026-001')
  await page.getByLabel('請求先名').fill('株式会社サンプル')
  await fillFirstItem(page, '制作費', '2', '500')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '明細CSV' }).click()])
  expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9._-]+\.csv$/)
  const buf = fs.readFileSync(await download.path())
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf8')
  expect(text).toContain('品目')
  expect(text).toContain('株式会社サンプル')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('入力はリロード後も復元される', async ({ page }) => {
  await page.getByLabel('請求先名').fill('復元テスト株式会社')
  await fillFirstItem(page, '保守費', '3', '2000')
  await page.reload()
  await expect(page.getByLabel('請求先名')).toHaveValue('復元テスト株式会社')
  await expect(page.getByLabel('単価 1')).toHaveValue('2000')
})
