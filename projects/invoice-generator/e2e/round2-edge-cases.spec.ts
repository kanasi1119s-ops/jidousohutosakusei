import { test, expect } from '@playwright/test'

test('不正な数量・単価でも画面にNaNが出ない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#item-0-qty', 'あいう')
  await page.fill('#item-0-price', 'abc')
  await expect(page.locator('#preview')).not.toContainText('NaN')
  await expect(page.locator('#errors')).toContainText('数量')
})

test('巨大な金額でも表示が崩れず横スクロールが出ない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#item-0-name', 'あ'.repeat(200))
  await page.fill('#item-0-price', '999999999999')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('HTMLタグを含む入力はテキストとして表示される(XSS対策)', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror=window.__x=1>')
  await expect(page.locator('#pv-client')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
})

test('明細の追加と削除', async ({ page }) => {
  await page.goto('/')
  await page.click('#add-item')
  await expect(page.locator('#items .item')).toHaveCount(2)
  await page.click('#item-1-del')
  await expect(page.locator('#items .item')).toHaveCount(1)
})
