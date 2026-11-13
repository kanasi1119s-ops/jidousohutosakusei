import { test, expect } from '@playwright/test'

test('負の給与収入でエラーが表示され結果は隠れる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '-1')
  await page.click('button:has-text("上限額を試算する")')
  await expect(page.locator('#errors')).toContainText('0以上')
  await expect(page.locator('#result')).toBeHidden()
})

test('巨大な給与収入でもクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '99999999')
  await page.click('button:has-text("上限額を試算する")')
  await expect(page.locator('#limit')).toContainText('円')
})

test('寄附額が1,000円未満だとエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-date', '2026-11-05')
  await page.fill('#d-muni', 'A市')
  await page.fill('#d-amount', '500')
  await page.click('#add-donation')
  await expect(page.locator('#d-errors')).toContainText('1,000円以上')
  await expect(page.locator('#donation-body tr')).toHaveCount(0)
})

test('自治体名にHTMLを入れてもスクリプトとして実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-date', '2026-11-05')
  await page.fill('#d-muni', '<img src=x onerror="window.__xss=1">')
  await page.fill('#d-amount', '5000')
  await page.click('#add-donation')
  await expect(page.locator('#donation-body')).toContainText('<img')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('6自治体に寄附するとワンストップ警告', async ({ page }) => {
  await page.goto('/')
  for (const m of ['A', 'B', 'C', 'D', 'E', 'F']) {
    await page.fill('#d-date', '2026-11-05')
    await page.fill('#d-muni', m + '市')
    await page.fill('#d-amount', '5000')
    await page.click('#add-donation')
  }
  await expect(page.locator('#tracker-status')).toContainText('確定申告が必要')
})

test('不正なJSONのインポートでエラー表示', async ({ page }) => {
  await page.goto('/')
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fc.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"input":1}', 'utf-8') })
  await expect(page.locator('#io-errors')).toContainText('不正')
})

test('オフラインでもリロード後に動作する', async ({ page, context, baseURL }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await page.click('button:has-text("上限額を試算する")')
  await expect(page.locator('#limit')).toContainText('円')
  void baseURL
})
