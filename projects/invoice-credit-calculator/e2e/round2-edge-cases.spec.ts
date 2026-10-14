import { test, expect } from '@playwright/test'

test('全角数字・カンマ・円記号の金額と全角日付を受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-date', '2026-10-01')
  await page.fill('#f-amount', '１１，０００円')
  await page.click('#add-btn')
  await expect(page.locator('#result-body tr')).toContainText('700円')
})

test('HTMLを含む取引先名がスクリプトとして実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-date', '2026-10-01')
  await page.fill('#f-supplier', '<img src=x onerror="window.__xss=1">')
  await page.fill('#f-amount', '1000')
  await page.click('#add-btn')
  await expect(page.locator('#result-body img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('保存した明細がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-date', '2027-01-15')
  await page.fill('#f-supplier', '保存テスト')
  await page.fill('#f-amount', '5500')
  await page.click('#add-btn')
  await page.reload()
  await expect(page.locator('#result-body')).toContainText('保存テスト')
})

test('巨大な金額でもクラッシュしない／上限超過はエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-date', '2026-10-01')
  await page.fill('#f-amount', '999999999999')
  await page.click('#add-btn')
  await expect(page.locator('#result-body tr')).toHaveCount(1)
  await page.fill('#f-amount', '99999999999999999')
  await page.click('#add-btn')
  await expect(page.locator('#errors')).toContainText('税込金額')
})

test('不正なJSONを復元しようとしてもデータが壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-date', '2026-10-01')
  await page.fill('#f-amount', '1100')
  await page.click('#add-btn')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"purchases":[{"id":1}]}') })
  await expect(page.locator('#io-errors')).toContainText('形式が不正')
  await expect(page.locator('#result-body tr')).toHaveCount(1)
})

test('サーバーを停止したオフライン状態でも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス経過措置 仕入税額控除計算機')
  await page.fill('#f-date', '2026-10-01')
  await page.fill('#f-amount', '11000')
  await page.click('#add-btn')
  await expect(page.locator('#result-body')).toContainText('700円')
  await context.setOffline(false)
})

test('CSP違反などのコンソールエラーが出ない（外部通信ゼロの担保）', async ({ page }) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url())
  })
  await page.goto('/')
  await page.fill('#f-date', '2026-10-01')
  await page.fill('#f-amount', '11000')
  await page.click('#add-btn')
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
