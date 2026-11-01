import { expect, test } from '@playwright/test'

test('不正な数値入力でもクラッシュせず警告が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[aria-label="単価1"]', 'abc')
  await expect(page.locator('#warnings')).toContainText('数値として読み取れません')
  await expect(page.locator('#preview')).toBeVisible()
})

test('XSS文字列がそのまま文字として表示され実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-customer', '<img src=x onerror="window.__x=1">')
  await expect(page.locator('#preview')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
  expect(await page.locator('#preview img').count()).toBe(0)
})

test('不正なJSONのインポートは失敗メッセージを出す', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{oops') })
  await expect(page.locator('#msg')).toContainText('インポートに失敗')
})

test('明細を全削除しても動作する', async ({ page }) => {
  await page.goto('/')
  await page.click('button[aria-label="明細1を削除"]')
  await expect(page.locator('#warnings')).toContainText('明細が1件もありません')
  await expect(page.locator('#preview-total')).toHaveText('¥0')
})

test('スマホ幅で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
