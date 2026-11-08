import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuerName', '山田デザイン')
  await page.fill('#issuerRegistrationNumber', 'T1234567890123')
  await page.fill('#clientName', '株式会社サンプル')
  await page.fill('#subject', 'ロゴ制作')
  await page.fill('.item-name >> nth=0', 'ロゴデザイン')
  await page.fill('.item-qty >> nth=0', '1')
  await page.fill('.item-price >> nth=0', '60000')
}

test('日本語の見出し・ボタン・プレビューが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書メーカー（適格請求書対応）')
  await expect(page.locator('#save')).toHaveText('保存')
  await expect(page.locator('#print')).toHaveText('印刷 / PDFに保存')
  await fillBasic(page)
  const pv = page.locator('#preview')
  await expect(pv).toContainText('請求書（適格請求書）')
  await expect(pv).toContainText('株式会社サンプル 御中')
  await expect(pv).toContainText('登録番号: T1234567890123')
  await expect(pv).toContainText('¥66,000')
  await expect(pv).toContainText('10%消費税額')
})

test('税率混在: 国税庁Q&A例の税額が表示される(税込・切り捨て)', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#priceMode', 'inclusive')
  await fillBasic(page)
  await page.click('#add-item')
  await page.fill('.item-name >> nth=1', '飲料')
  await page.fill('.item-price >> nth=1', '40000')
  await page.selectOption('.item-rate >> nth=1', '8')
  const pv = page.locator('#preview')
  await expect(pv).toContainText('¥5,454')
  await expect(pv).toContainText('¥2,962')
  await expect(pv).toContainText('¥100,000')
})

test('保存→一覧表示→リロード後も復元→CSVはBOM付きUTF-8', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  await expect(page.locator('#status')).toContainText('保存しました')
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  expect(dl.suggestedFilename()).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf8')).toContain('株式会社サンプル')
})

test('JSONバックアップのエクスポート→全削除→インポートで復元できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-json')])
  expect(dl.suggestedFilename()).toMatch(/^invoice-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await dl.path())!
  page.once('dialog', (d) => d.accept())
  await page.click('#saved-list button.secondary')
  await expect(page.locator('#saved-list')).toContainText('まだ保存した請求書はありません')
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#saved-list')).toContainText('株式会社サンプル')
})
