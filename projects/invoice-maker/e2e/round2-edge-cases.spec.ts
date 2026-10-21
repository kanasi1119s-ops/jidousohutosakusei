import { test, expect } from '@playwright/test'

test('全角数字・カンマ入力でも計算される', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="単価1"]', '１,０００')
  await expect(page.locator('#preview')).toContainText('¥1,100')
})

test('不正なJSONのインポートはエラー表示でクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('HTMLを含む入力がそのまま文字として表示される（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview img')).toHaveCount(0)
})

test('巨大な数値でもクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="単価1"]', '99999999999')
  await expect(page.locator('#preview')).toContainText('合計')
})

test('数量が空欄でもクラッシュせず印刷時にエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuerName', 'x')
  await page.fill('#clientName', 'y')
  await page.fill('[aria-label="品名1"]', 'z')
  await page.fill('[aria-label="数量1"]', '')
  await page.click('#print')
  await expect(page.locator('#errors')).toContainText('数量')
  // 入力途中(NaN)の状態でも保存データが壊れず、リロード後に復元される
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('y')
})

test('入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '復元テスト商事')
  await page.reload()
  await expect(page.locator('#clientName')).toHaveValue('復元テスト商事')
  await expect(page.locator('#preview')).toContainText('復元テスト商事')
})

test('横スクロールが発生しない（375px / 1280px）', async ({ page }) => {
  for (const w of [375, 1280]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto('/')
    await page.fill('[aria-label="品名1"]', 'とても長い品名'.repeat(10))
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(over, `width ${w}`).toBe(false)
  }
})

test('印刷時はプレビューだけが表示される', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#form')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('オフラインでもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書・見積書メーカー')
  await page.fill('#clientName', 'オフライン商会')
  await expect(page.locator('#preview')).toContainText('オフライン商会')
  await context.setOffline(false)
})
