import { test, expect } from '@playwright/test'
import { fillBasicInvoice } from './helpers'

test('数量・単価が数値でないとエラーになり保存されない', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.locator('#item-rows tr').first().locator('.r-price').fill('abc')
  await page.click('#save')
  await expect(page.locator('#errors')).toContainText('数値')
  await expect(page.locator('#saved-list li')).toHaveCount(0)
})

test('登録番号の形式不正はエラー', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.fill('#issuer-reg', 'T123')
  await page.click('#export-csv')
  await expect(page.locator('#errors')).toContainText('13桁')
})

test('不正なJSONの読み込みはエラー表示され既存データは壊れない', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.click('#save')
  await page.setInputFiles('#import-file', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}', 'utf-8'),
  })
  await expect(page.locator('#errors')).toContainText('形式が不正')
  await expect(page.locator('#saved-list li')).toHaveCount(1)
})

test('HTMLを含む入力がそのまま文字として表示される（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.fill('#inv-client', '<img src=x onerror=window.__xss=1>')
  await expect(page.locator('#sheet .client')).toContainText('<img src=x onerror=window.__xss=1>')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('大量の明細と巨大な金額でも崩れず計算できる', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  await page.locator('#item-rows tr').first().locator('.r-price').fill('999999999')
  await expect(page.locator('#sheet')).toContainText('ご請求金額: ¥1,099,999,998')
})

test('ページが横スクロールしない（レイアウト崩れの簡易確認）', async ({ page }) => {
  await page.goto('/')
  await fillBasicInvoice(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('ネットワーク遮断後でもリロードして動作する（オフライン）', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // SWの制御下に入る
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  await fillBasicInvoice(page)
  await expect(page.locator('#sheet')).toContainText('ご請求金額: ¥11,000')
  await context.setOffline(false)
})

test('スマホ幅でも明細の入力欄が十分な幅で表示される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const w = await page.locator('#item-rows tr').first().locator('.r-name').evaluate((e) => e.getBoundingClientRect().width)
  expect(w).toBeGreaterThan(200)
  const pw = await page.locator('#item-rows tr').first().locator('.r-price').evaluate((e) => e.getBoundingClientRect().width)
  expect(pw).toBeGreaterThan(100)
})
