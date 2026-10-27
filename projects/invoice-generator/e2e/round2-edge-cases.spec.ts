import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('不正な登録番号・数量はエラー表示になりクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-reg', 'T123')
  await page.fill('#item-qty-0', '1.23456')
  await expect(page.locator('#messages')).toContainText('登録番号')
  await expect(page.locator('#messages')).toContainText('小数第3位')
})

test('明細が空欄・巨大値でも画面が壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#item-qty-0', '')
  await page.fill('#item-price-0', '')
  await expect(page.locator('#invoice-preview')).toBeVisible()
  await page.fill('#item-qty-0', '99999')
  await page.fill('#item-price-0', '999999999')
  await expect(page.locator('#messages')).toContainText('大きすぎます')
  await expect(page.locator('#invoice-preview')).toBeVisible()
})

test('全角数字で入力しても計算される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#item-qty-0', '１')
  await page.fill('#item-price-0', '１，０００')
  await expect(page.locator('#invoice-preview')).toContainText('¥1,100')
})

test('HTMLを含む入力は文字としてそのまま表示され、実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#invoice-preview .client-name')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('#invoice-preview img').count()).toBe(0)
})

test('不正なJSONを読み込むとエラーメッセージが出る', async ({ page }, testInfo) => {
  await page.goto('/')
  // ASCIIのパスを使う（日本語を含むパスだとファイル選択が読み込めない環境があるため）
  const p = path.join(os.tmpdir(), `invoice-bad-${testInfo.project.name}.json`)
  fs.writeFileSync(p, '{"version":1,"saved":"x"}')
  await page.setInputFiles('#import-json', p)
  await expect(page.locator('#status')).toContainText('形式が不正')
})

test('入力内容がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '復元テスト株式会社')
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('復元テスト株式会社')
})

test('スマホ幅(375px)・PC幅(1280px)で横スクロールが発生しない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#item-name-0', 'とても長い品名とても長い品名とても長い品名とても長い品名とても長い品名')
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflow, `width=${width}`).toBe(false)
  }
})

test('印刷用表示では入力フォームが隠れ、請求書だけが残る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '印刷テスト')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.form')).toBeHidden()
  await expect(page.locator('#invoice-preview')).toBeVisible()
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('適格請求書ジェネレーター')
  await page.fill('#item-price-0', '1000')
  await expect(page.locator('#invoice-preview')).toContainText('¥1,100')
  await context.setOffline(false)
})

test('JSONでないファイルを読み込むと、原因が分かるエラーメッセージが出る', async ({ page }, testInfo) => {
  await page.goto('/')
  const p = path.join(os.tmpdir(), `invoice-notjson-${testInfo.project.name}.json`)
  fs.writeFileSync(p, 'これはJSONではありません')
  await page.setInputFiles('#import-json', p)
  await expect(page.locator('#status')).toContainText('JSONとして不正')
})
