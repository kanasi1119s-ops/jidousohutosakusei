import { test, expect } from '@playwright/test'

test('リロード後も入力値が復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '4200000')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#salaryYen')).toHaveValue('4200000')
})

test('2,000万円超は対象外のエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '30000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('対象外')
})

test('不正なJSONのインポートでエラーが表示されクラッシュしない', async ({ page }) => {
  await page.goto('/')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{oops') })
  await expect(page.locator('#errors')).toContainText('JSON')
  await expect(page.locator('h1')).toBeVisible()
})

test('横スクロールが発生しない', async ({ page }) => {
  await page.goto('/')
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalScroll).toBe(false)
})

test('年収別の目安表が表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('年収別の目安')).toBeVisible()
  await expect(page.locator('table').last().locator('tbody tr')).toHaveCount(8)
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await page.fill('#salaryYen', '6000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit-main')).toContainText('控除上限額の目安')
  await context.setOffline(false)
})
