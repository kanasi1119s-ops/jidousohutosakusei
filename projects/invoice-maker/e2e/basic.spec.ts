import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.locator('#issuer-name').fill('山田デザイン事務所')
  await page.locator('#issuer-reg').fill('T1234567890123')
  await page.locator('#client-name').fill('株式会社サンプル')
  await page.locator('#inv-number').fill('2026-001')
  await page.getByLabel('品名 1').fill('ロゴデザイン制作')
  await page.getByLabel('数量 1').fill('１')
  await page.getByLabel('単価 1').fill('１０，０００')
}

test('日本語の見出し・ボタンが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'インボイス対応 請求書メーカー' })).toBeVisible()
  await expect(page.getByRole('button', { name: '印刷 / PDFとして保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSVをダウンロード' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  const body = await page.locator('body').innerText()
  expect(body).not.toContain('\uFFFD')
})

test('全角入力でも税率ごとに計算され、プレビューに反映される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.getByRole('button', { name: '＋ 明細を追加' }).click()
  await page.getByLabel('品名 2').fill('お菓子（軽減税率）')
  await page.getByLabel('単価 2').fill('1000')
  await page.getByLabel('税率 2').selectOption('8')
  const preview = page.locator('#preview')
  await expect(preview).toContainText('株式会社サンプル 御中')
  await expect(preview).toContainText('登録番号: T1234567890123')
  await expect(preview).toContainText('10% 消費税額')
  await expect(preview).toContainText('8% 消費税額')
  // 10,000*1.1 + 1,000*1.08 = 11,000 + 1,080
  await expect(page.locator('#preview-total')).toHaveText('¥12,080')
  await expect(preview).toContainText('※ は軽減税率')
})

test('源泉徴収を切り替えると差引請求額になる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.locator('#withholding').check()
  // 10,000 -> 源泉 1,021 、税込 11,000 - 1,021 = 9,979
  await expect(page.locator('#preview-total')).toHaveText('¥9,979')
})

test('登録番号の形式が不正だとエラー表示', async ({ page }) => {
  await page.goto('/')
  await page.locator('#issuer-reg').fill('12345')
  await expect(page.locator('#reg-error')).toContainText('T')
  await page.locator('#issuer-reg').fill('T1234567890123')
  await expect(page.locator('#reg-error')).toHaveText('')
})

test('CSVはBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSVをダウンロード' }).click()])
  expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.csv$/)
  const path = await download.path()
  const buf = fs.readFileSync(path!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('ロゴデザイン制作')
  expect(text).not.toContain('\uFFFD')
})

test('リロード後も入力が復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.reload()
  await expect(page.locator('#client-name')).toHaveValue('株式会社サンプル')
  await expect(page.getByLabel('品名 1')).toHaveValue('ロゴデザイン制作')
  await expect(page.locator('#preview-total')).toHaveText('¥11,000')
})

test('保存・読み込み・複製・削除と、JSONバックアップの往復', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.getByRole('button', { name: 'この請求書を保存' }).click()
  await expect(page.locator('#saved-list li')).toHaveCount(1)
  await expect(page.locator('#saved-list')).toContainText('2026-001')

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSONバックアップを保存' }).click()])
  expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.json$/)
  const jsonPath = await download.path()
  const backupText = fs.readFileSync(jsonPath!, 'utf-8')
  expect(backupText).toContain('株式会社サンプル')

  // 全消去してから復元
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#client-name')).toHaveValue('')
  await page.locator('#import-json').setInputFiles(jsonPath!)
  await expect(page.locator('#client-name')).toHaveValue('株式会社サンプル')
  await expect(page.locator('#saved-list li')).toHaveCount(1)

  // 複製
  await page.locator('[data-action="duplicate"]').click()
  await expect(page.locator('#inv-number')).toHaveValue('')
  await expect(page.locator('#client-name')).toHaveValue('株式会社サンプル')

  // 削除
  page.once('dialog', (d) => d.accept())
  await page.locator('[data-action="delete"]').click()
  await expect(page.locator('#saved-list')).toContainText('まだ保存された請求書はありません')
})
