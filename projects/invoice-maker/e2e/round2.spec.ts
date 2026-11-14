import { expect, test } from '@playwright/test'

test('HTMLを含む入力はタグとして解釈されない（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await page.locator('#client-name').fill('<img src=x onerror="window.__xss=1">')
  await page.getByTestId('item-name').first().fill('<script>window.__xss=1</script>')
  await expect(page.getByTestId('preview')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('#preview img').count()).toBe(0)
})

test('不正・空・巨大な数値でもクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('item-price').first().fill('abc')
  await expect(page.getByTestId('grand-total')).toContainText('¥0')
  await page.getByTestId('item-qty').first().fill('99999999')
  await page.getByTestId('item-price').first().fill('99999999')
  await expect(page.getByTestId('grand-total')).toContainText('¥0')
  await expect(page.locator('#warn')).toContainText('範囲外')
})

test('印刷表示では入力欄が隠れ請求書のみが残る', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('item-price').first().fill('1000')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#editor')).toBeHidden()
  await expect(page.locator('header.site')).toBeHidden()
  await expect(page.getByTestId('preview')).toBeVisible()
})

test('最後の明細を削除しても1行残る', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('item-delete').first().click()
  await expect(page.getByTestId('item-name')).toHaveCount(1)
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('外部ドメインへの通信が発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')) external.push(r.url()) })
  await page.goto('/')
  await page.getByTestId('item-price').first().fill('1000')
  expect(external).toEqual([])
})

test('オフラインでもリロード後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '請求書メーカー' })).toBeVisible()
  await page.getByTestId('item-price').first().fill('1000')
  await expect(page.getByTestId('grand-total')).toContainText('¥1,100')
  await context.setOffline(false)
})
