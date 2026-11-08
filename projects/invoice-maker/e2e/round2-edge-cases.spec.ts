import { test, expect } from '@playwright/test'

test('空のまま保存するとエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.click('#save')
  await expect(page.locator('#errors')).toContainText('発行者の名称')
  await expect(page.locator('#errors')).toContainText('請求先の名称')
})

test('全角数字の数量・単価と全角の登録番号を受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerRegistrationNumber', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('.item-name >> nth=0', 'テスト')
  await page.fill('.item-qty >> nth=0', '２')
  await page.fill('.item-price >> nth=0', '１，０００')
  await expect(page.locator('#preview')).toContainText('¥2,200')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
})

test('不正な登録番号は保存できない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerName', 'A')
  await page.fill('#clientName', 'B')
  await page.fill('#issuerRegistrationNumber', 'T123')
  await page.fill('.item-name >> nth=0', 'x')
  await page.click('#save')
  await expect(page.locator('#errors')).toContainText('登録番号')
})

test('巨大な金額でもクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('.item-qty >> nth=0', '100')
  await page.fill('.item-price >> nth=0', '9999999999')
  await expect(page.locator('#preview')).toContainText('ご請求金額')
})

test('数量を入力途中(空欄)でリロードしても下書きが壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '再読込テスト商事')
  await page.fill('.item-qty >> nth=0', '')
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('再読込テスト商事')
})

test('HTMLを含む入力がそのまま文字として表示され、実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#preview')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('スマホ幅・PC幅で横スクロールが発生しない', async ({ page }) => {
  for (const w of [375, 1280]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto('/')
    await page.fill('.item-name >> nth=0', 'とても長い品名とても長い品名とても長い品名とても長い品名')
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(over).toBe(false)
  }
})

test('印刷用CSSで操作画面が隠れ、請求書のみ表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', 'X')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('h1')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー（適格請求書対応）')
  await page.fill('.item-price >> nth=0', '1000')
  await expect(page.locator('#preview')).toContainText('合計（税込）')
  await context.setOffline(false)
})
