import { test, expect } from '@playwright/test'

test('数量・単価が数値でないときはエラー表示、クラッシュしない', async ({ page }) => {
  await page.goto('/')
  const row = page.locator('#items-body tr').first()
  await row.locator('.it-qty').fill('abc')
  await expect(page.locator('#messages')).toContainText('数量は数値')
  await expect(page.locator('#preview')).toBeVisible()
})

test('巨大な金額でも画面が崩れず例外にならない', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  const row = page.locator('#items-body tr').first()
  await row.locator('.it-qty').fill('999999')
  await row.locator('.it-price').fill('9999999999')
  await expect(page.locator('#messages')).toContainText('大きすぎます')
  await expect(page.locator('#pv-total')).toContainText('円')
  expect(errors).toEqual([])
})

test('明細の追加と削除（最後の1行は削除されない）', async ({ page }) => {
  await page.goto('/')
  await page.click('#add-item')
  await expect(page.locator('#items-body tr')).toHaveCount(2)
  await page.locator('#items-body tr').nth(1).locator('button').click()
  await expect(page.locator('#items-body tr')).toHaveCount(1)
  await page.locator('#items-body tr').first().locator('button').click()
  await expect(page.locator('#items-body tr')).toHaveCount(1)
})

test('軽減税率8%と10%が混在すると税率ごとに内訳が表示される', async ({ page }) => {
  await page.goto('/')
  await page.locator('#items-body tr').first().locator('.it-price').fill('1000')
  await page.click('#add-item')
  const r2 = page.locator('#items-body tr').nth(1)
  await r2.locator('.it-price').fill('1000')
  await r2.locator('.it-rate').selectOption('8')
  await expect(page.locator('#preview')).toContainText('10%対象 消費税額')
  await expect(page.locator('#preview')).toContainText('8%対象 消費税額')
  await expect(page.locator('#pv-total')).toHaveText('ご請求額 2,180円')
})

test('スマホ幅・PC幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})

test('印刷表示ではプレビュー以外が非表示になる', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#save')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('オフライン（サーバー停止相当）でも再読み込み後に表示・計算できる', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書ジェネレーター')
  await page.locator('#items-body tr').first().locator('.it-price').fill('500')
  await expect(page.locator('#pv-total')).toHaveText('ご請求額 550円')
  await context.setOffline(false)
})
