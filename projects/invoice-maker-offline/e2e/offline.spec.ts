import { expect, test } from '@playwright/test'

test('一度開けばオフラインでも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Service Worker が制御を開始するまで再読み込み
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await page.locator('.li-desc').first().fill('オフライン入力')
  await page.locator('.li-price').first().fill('2000')
  await expect(page.locator('#sum-body')).toContainText('2,200円')
})

test('外部ドメインへのリクエストが発生しない', async ({ page, baseURL }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(baseURL as string) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
  })
  await page.goto('/')
  await page.locator('.li-price').first().fill('1000')
  await page.waitForTimeout(500)
  expect(external).toEqual([])
})
