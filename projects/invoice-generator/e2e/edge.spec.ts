import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('空入力・巨大入力・不正な数値でも落ちずにエラーを表示する', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.fill('.item-qty', '99999999999')
  await page.fill('.item-price', 'abc')
  await expect(page.locator('#errors')).toContainText('数量')
  await expect(page.locator('#errors')).toContainText('単価')
  await page.fill('.item-qty', '1')
  await page.fill('.item-price', '99999999999')
  await expect(page.locator('#errors')).toContainText('単価')
  await expect(page.locator('#pv-total')).toBeVisible()
  expect(errors).toEqual([])
})

test('HTMLを含む入力はタグとして解釈されずそのまま表示される（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#client-name', '<img src=x onerror=window.__xss=1>')
  await page.fill('.item-desc', '<b>太字</b>')
  await expect(page.locator('#pv-client')).toHaveText('<img src=x onerror=window.__xss=1>')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('#pv-items b')).toHaveCount(0)
})

test('CSVの先頭が = の入力は式として解釈されないよう無害化される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-name', 'A社')
  await page.fill('#issuer-reg', 'T1234567890123')
  await page.fill('#client-name', '=CMD()')
  await page.fill('.item-desc', 'x')
  await page.fill('.item-price', '100')
  await page.click('#save-invoice')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const text = fs.readFileSync((await (await dl).path())!, 'utf-8')
  expect(text).toContain("'=CMD()")
})

test('印刷表示ではフォームが隠れ、請求書のみになる', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.editor')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('スマホ幅(375px)でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await page.fill('.item-desc', 'とても長い品目名とても長い品目名とても長い品目名とても長い品目名')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('不正なバックアップファイルは拒否される', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(page.locator('#status')).toContainText('バックアップファイルではありません')
})

test('オフライン（サーバー停止状態）でも再読み込みして動作する', async ({ page, browserName }, info) => {
  test.skip(info.project.name !== 'chromium', 'chromiumのみで検証')
  void browserName
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // SW制御下に入れる
  await page.context().setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書ジェネレーター')
  await page.fill('.item-price', '500')
  await expect(page.locator('#pv-total')).toHaveText('¥550')
})

