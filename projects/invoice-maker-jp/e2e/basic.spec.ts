import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { fillBasic } from './helpers'

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('#print')).toHaveText('印刷 / PDF保存')
  await expect(page.locator('.p-title')).toHaveText('請求書')
})

test('入力するとプレビューに登録番号・税率別の消費税が表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const paper = page.locator('#preview')
  await expect(paper).toContainText('山田商店')
  await expect(paper).toContainText('登録番号: T1234567890123')
  await expect(paper).toContainText('株式会社テスト 御中')
  await expect(paper).toContainText('取引年月日: 2026年10月分')
  await expect(page.locator('#grand-total')).toContainText('¥11,000')
  await expect(page.locator('#tax-summary')).toContainText('10%対象')
  await expect(page.locator('#tax-summary')).toContainText('¥1,000')
})

test('軽減税率の明細に※が付き、税率ごとに集計される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  const row = page.locator('.item-row').nth(1)
  await row.locator('.item-name').fill('お弁当')
  await row.locator('.item-qty').fill('2')
  await row.locator('.item-price').fill('540')
  await row.locator('.item-rate').selectOption('8')
  await expect(page.locator('#preview')).toContainText('お弁当 ※')
  await expect(page.locator('#preview')).toContainText('※は軽減税率（8%）対象品目です。')
  await expect(page.locator('#tax-summary tbody tr')).toHaveCount(2)
  // 10,000*1.1 + 1,080*1.08 = 11,000 + 1,166(1,080+86) → 税込 12,166
  await expect(page.locator('#grand-total')).toContainText('¥12,166')
})

test('全角数字で入力しても計算できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const row = page.locator('.item-row').first()
  await row.locator('.item-qty').fill('２')
  await row.locator('.item-price').fill('１，５００')
  await expect(page.locator('#grand-total')).toContainText('¥3,300')
})

test('CSVエクスポートがBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-INV-2026-0001-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect(buf[0]).toBe(0xef)
  expect(buf[1]).toBe(0xbb)
  expect(buf[2]).toBe(0xbf)
  const text = buf.toString('utf-8')
  expect(text).toContain('品名')
  expect(text).toContain('制作費')
  expect(text).not.toContain('\uFFFD')
})

test('保存→一覧→バックアップJSONの往復ができる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-doc')
  await expect(page.locator('#saved-list .open-doc')).toContainText('INV-2026-0001')

  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const jsonPath = (await download.path())!

  // 保存済みを全削除して復元する
  page.once('dialog', (d) => d.accept())
  await page.click('.delete-doc')
  await expect(page.locator('#saved-list .empty')).toBeVisible()
  await page.setInputFiles('#import-json', jsonPath)
  await expect(page.locator('#saved-list .open-doc')).toContainText('株式会社テスト')
  await expect(page.locator('#status')).toContainText('読み込みました')
})

test('新しい書類で番号が繰り上がる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#new-doc')
  await expect(page.locator('#doc-number')).toHaveValue('INV-2026-0002')
  await expect(page.locator('#doc-client')).toHaveValue('')
})

test('書類の種類を切り替えると見出しが変わる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#doc-kind', 'receipt')
  await expect(page.locator('.p-title')).toHaveText('領収書')
  await expect(page.locator('.p-receipt-note')).toContainText('領収いたしました')
  await page.selectOption('#doc-kind', 'quote')
  await expect(page.locator('.p-title')).toHaveText('見積書')
})
