import { expect, test } from '@playwright/test'

async function start(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

test('巨大な数値は範囲外として警告され、計算が壊れない', async ({ page }) => {
  await start(page)
  await page.fill('[data-row="0"] [data-f="unitPrice"]', '99999999999999')
  await page.fill('[data-row="0"] [data-f="quantity"]', '99999')
  await expect(page.locator('#warnings')).toContainText('範囲')
  await expect(page.locator('#grand-total')).toHaveText('0円')
})

test('印刷時は編集フォームが非表示で請求書のみ表示される', async ({ page }) => {
  await start(page)
  await page.fill('#clientName', '印刷テスト')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#editor')).toBeHidden()
  await expect(page.locator('#sheet')).toBeVisible()
  await expect(page.locator('#sheet')).toContainText('印刷テスト')
})

test('長い無改行文字列・多数の明細でもページ全体が横スクロールしない', async ({ page }) => {
  await start(page)
  await page.fill('#clientName', 'あ'.repeat(200))
  await page.fill('[data-row="0"] [data-f="name"]', 'A'.repeat(300))
  for (let i = 0; i < 20; i++) await page.click('#add-item')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('追加・削除を繰り返しても壊れない', async ({ page }) => {
  await start(page)
  await page.click('#add-item')
  await page.click('#add-item')
  await expect(page.locator('.item-row')).toHaveCount(3)
  await page.click('[data-del="0"]')
  await page.click('[data-del="0"]')
  await page.click('[data-del="0"]')
  await expect(page.locator('.item-row')).toHaveCount(1)
})

test('負数（値引き）の明細が合計に反映される', async ({ page }) => {
  await start(page)
  await page.fill('[data-row="0"] [data-f="unitPrice"]', '10000')
  await page.click('#add-item')
  await page.fill('[data-row="1"] [data-f="unitPrice"]', '－1000')
  await expect(page.locator('#grand-total')).toHaveText('9,900円')
})

test('サンドボックス外への通信が発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) external.push(r.url())
  })
  await start(page)
  await page.fill('#clientName', 'x')
  expect(external).toEqual([])
})

test('保存されたデータが壊れていても起動できる', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('invoice-maker:draft:v1', '{broken'))
  await page.reload()
  await expect(page.locator('#grand-total')).toHaveText('0円')
})
