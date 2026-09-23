import { test, expect } from '@playwright/test'

test('巨大な入力値でもクラッシュせず表示できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hourlyWageYen', '100000000')
  await page.fill('#hoursPerWeek', '40')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#annual-income')).toContainText('想定年収')
})

test('週168時間を超える極端な入力はエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hoursPerWeek', '200')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('168時間')
})

test('空欄のまま送信してもクラッシュせずエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hourlyWageYen', '')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('時給')
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#hourlyWageYen', '1777')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#hourlyWageYen')).toHaveValue('1777')
})

test('PC幅(1280px)でもレイアウトが崩れない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalScroll).toBe(false)
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  // Service Worker がキャッシュを登録するのを待つ
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })

  await context.setOffline(true)
  await page.reload()

  await expect(page.locator('h1')).toHaveText('年収の壁シミュレーター')
  await page.fill('#hourlyWageYen', '1200')
  await page.click('button[type="submit"]')
  await expect(page.locator('#annual-income')).toContainText('想定年収')

  await context.setOffline(false)
})
