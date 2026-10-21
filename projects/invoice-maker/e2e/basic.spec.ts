import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuerName', '山田太郎デザイン')
  await page.fill('#registrationNumber', 'T1234567890123')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('[aria-label="品名1"]', 'ロゴ制作')
  await page.fill('[aria-label="単価1"]', '105')
  await page.click('#add-item')
  await page.fill('[aria-label="品名2"]', '菓子折り')
  await page.fill('[aria-label="単価2"]', '99')
  await page.selectOption('[aria-label="税率2"]', '8')
}

test('日本語の見出しとボタンが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書・見積書メーカー')
  await expect(page.getByRole('button', { name: '印刷／PDF保存' })).toBeVisible()
  await expect(page.locator('#preview h2')).toContainText('請')
})

test('税率ごとの消費税額がプレビューに表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const pv = page.locator('#preview')
  await expect(pv).toContainText('株式会社サンプル 御中')
  await expect(pv).toContainText('登録番号: T1234567890123')
  await expect(pv).toContainText('10%対象 消費税額')
  await expect(pv).toContainText('合計（税込）')
})

test('合計金額が正しい（105円×10%・99円×8%、切り捨て）', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  // 105+10=115, 99+7=106 => 221
  await expect(page.locator('#preview')).toContainText('¥221')
})

test('必須項目が空のまま印刷しようとするとエラー', async ({ page }) => {
  await page.goto('/')
  await page.click('#print')
  await expect(page.locator('#errors')).toContainText('発行者名')
})

test('登録番号の形式が不正だとエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#registrationNumber', 'T123')
  await page.fill('#issuerName', 'x')
  await page.fill('#clientName', 'y')
  await page.fill('[aria-label="品名1"]', 'z')
  await page.click('#print')
  await expect(page.locator('#errors')).toContainText('13桁')
})

test('CSVがBOM付きUTF-8で日本語を含み、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('ロゴ制作')
})

test('JSONのエクスポート→インポートで往復できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const path = (await (await dl).path())!
  page.once('dialog', (d) => d.accept())
  await page.click('#reset')
  await expect(page.locator('#clientName')).toHaveValue('')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#clientName')).toHaveValue('株式会社サンプル')
  await expect(page.locator('[aria-label="品名2"]')).toHaveValue('菓子折り')
})
