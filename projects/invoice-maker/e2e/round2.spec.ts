import { expect, test } from '@playwright/test'

test('横スクロールが発生しない（375px/1280px）', async ({ page }) => {
  for (const w of [375, 1280]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto('/')
    await page.fill('#clientName', 'とても長い宛名'.repeat(20))
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(over, `width=${w}`).toBe(false)
  }
})

test('巨大・不正な数値入力でも画面が壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('.item[data-i="0"] [data-f="name"]', 'X')
  await page.fill('.item[data-i="0"] [data-f="quantity"]', '99999999999')
  await page.fill('.item[data-i="0"] [data-f="unitPrice"]', 'abc')
  await expect(page.locator('#preview')).toContainText('¥0')
  await page.fill('.item[data-i="0"] [data-f="unitPrice"]', '１２３')
  await expect(page.locator('#preview')).not.toContainText('NaN')
})

test('明細の追加・削除と軽減税率の※表示', async ({ page }) => {
  await page.goto('/')
  await page.click('#addItem')
  await page.fill('.item[data-i="1"] [data-f="name"]', '食品')
  await page.fill('.item[data-i="1"] [data-f="unitPrice"]', '100')
  await page.selectOption('.item[data-i="1"] [data-f="taxRate"]', '8')
  await expect(page.locator('#preview')).toContainText('食品 ※')
  await expect(page.locator('#preview')).toContainText('8%対象')
  await page.click('[data-del="1"]')
  await expect(page.locator('.item')).toHaveCount(1)
})
