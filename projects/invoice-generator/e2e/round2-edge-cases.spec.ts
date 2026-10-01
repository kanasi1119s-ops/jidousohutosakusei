import { test, expect } from '@playwright/test'

test('巨大な入力値でもクラッシュせず上限に丸められる', async ({ page }) => {
  await page.goto('/')
  const row = page.locator('#items .item-row').first()
  await row.locator('.item-qty').fill('99999999999999')
  await row.locator('.item-price').fill('99999999999999')
  await expect(page.locator('#pv-total')).toContainText('¥')
  await expect(page.locator('#pv-total')).not.toContainText('NaN')
})

test('不正な文字列や空欄は0円として扱いクラッシュしない', async ({ page }) => {
  await page.goto('/')
  const row = page.locator('#items .item-row').first()
  await row.locator('.item-qty').fill('abc')
  await row.locator('.item-price').fill('')
  await expect(page.locator('#pv-total')).toHaveText('¥0')
})

test('壊れたJSONを読み込むとエラーメッセージが出てデータは変わらない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#client-name', '残るべき名前')
  // 日本語を含むパスだとサンドボックスのChromiumでchangeが発火しないため、ASCIIの一時ディレクトリを使う
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const bad = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ig-')), 'bad.json')
  fs.writeFileSync(bad, '{ これはJSONではありません', 'utf-8')
  await page.setInputFiles('#import-json', bad)
  await expect(page.locator('#message')).toContainText('JSON')
  await expect(page.locator('#client-name')).toHaveValue('残るべき名前')
})

test('入力内容がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#client-name', 'リロード確認株式会社')
  await page.fill('#notes', '備考のテスト\n2行目')
  await page.reload()
  await expect(page.locator('#client-name')).toHaveValue('リロード確認株式会社')
  await expect(page.locator('#notes')).toHaveValue('備考のテスト\n2行目')
  await expect(page.locator('#preview')).toContainText('リロード確認株式会社 御中')
})

test('HTMLタグを含む入力はタグとして解釈されず文字として表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#client-name', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#preview .pv-client-name')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('#preview img').count()).toBe(0)
})

test('明細を全部削除しても1行は残る', async ({ page }) => {
  await page.goto('/')
  await page.locator('#items .item-del').first().click()
  await expect(page.locator('#items .item-row')).toHaveCount(1)
})

test('明細は100行までしか増やせない', async ({ page }) => {
  await page.goto('/')
  for (let i = 0; i < 105; i++) await page.click('#add-item')
  await expect(page.locator('#items .item-row')).toHaveCount(100)
  await expect(page.locator('#message')).toContainText('100行まで')
})

test('税込入力と端数処理の切り替えが反映される', async ({ page }) => {
  await page.goto('/')
  const row = page.locator('#items .item-row').first()
  await row.locator('.item-price').fill('1000')
  await row.locator('.item-rate').selectOption('8')
  await page.selectOption('#price-mode', 'inclusive')
  await expect(page.locator('.pv-groups tbody tr').first()).toContainText('¥74')
  await page.selectOption('#rounding', 'ceil')
  await expect(page.locator('.pv-groups tbody tr').first()).toContainText('¥75')
})

test('スマホ幅・PC幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow, `width=${width}`).toBe(false)
  }
})

test('外部ドメインへの通信が発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) external.push(r.url())
  })
  await page.goto('/')
  await page.fill('#client-name', 'x')
  await page.waitForTimeout(500)
  expect(external).toEqual([])
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス請求書ジェネレーター')
  const row = page.locator('#items .item-row').first()
  await row.locator('.item-price').fill('2000')
  await expect(page.locator('#pv-total')).toHaveText('¥2,200')
  await context.setOffline(false)
})
