import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('全角数字・カンマ付きの入力を受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '１１，０００，０００')
  await page.fill('#purchases10Yen', '０')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#tax-summary')).toContainText('1,000,000円')
})

test('巨大な入力値でもクラッシュせず表示できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '900000000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#result-body tr')).toHaveCount(4)
})

test('空欄・文字列の入力はエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('課税売上高（10%）')
  await page.fill('#sales10Yen', 'abc')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('数値')
})

test('登録なしでは特例が適用不可と表示される', async ({ page }) => {
  await page.goto('/')
  await page.uncheck('#registered')
  await page.click('button[type="submit"]')
  await expect(page.locator('#result-body tr').first()).toContainText('適用不可')
  await expect(page.locator('#best-summary')).not.toContainText('3割特例')
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '7777000')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#sales10Yen')).toHaveValue('7777000')
})

test('不正なJSONのインポートはエラー表示で、画面は壊れない', async ({ page }) => {
  await page.goto('/')
  const bad = path.join(os.tmpdir(), `bad-${Date.now()}.json`)
  fs.writeFileSync(bad, '{"taxYear": 2027, "sales10Yen": "x"}', 'utf-8')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(bad)
  await expect(page.locator('#errors')).toContainText('不正')
  await expect(page.locator('h1')).toBeVisible()
  fs.rmSync(bad)
})

test('HTMLを含む値を入力してもスクリプトが実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sales10Yen', '<img src=x onerror=window.__xss=1>')
  await page.click('button[type="submit"]')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('PC幅(1280px)でもレイアウトが崩れない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('消費税 納税額シミュレーター')
  await page.fill('#sales10Yen', '5500000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#tax-summary')).toContainText('500,000円')
  await context.setOffline(false)
})
