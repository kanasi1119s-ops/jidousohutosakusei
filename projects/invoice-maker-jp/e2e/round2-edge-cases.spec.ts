import { test, expect } from '@playwright/test'
import { fillBasic } from './helpers'

test('入力不備のまま印刷しようとするとエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.click('#print')
  await expect(page.locator('#errors')).toContainText('宛名')
  await expect(page.locator('#status')).toContainText('エラー')
})

test('登録番号の形式不正がエラーになり、未入力は警告になる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.fill('#issuer-reg', 'T123')
  await expect(page.locator('#errors')).toContainText('登録番号')
  await page.fill('#issuer-reg', '')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#warnings')).toContainText('登録番号が未入力')
  await page.fill('#doc-trans', '')
  await expect(page.locator('#warnings')).toContainText('取引年月日が未入力')
})

test('巨大な金額でクラッシュせずエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const row = page.locator('.item-row').first()
  await row.locator('.item-qty').fill('100000')
  await row.locator('.item-price').fill('100000000')
  await expect(page.locator('#errors')).toContainText('大きすぎ')
})

test('不正な数値入力（文字・小数の単価）でエラーになる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  const row = page.locator('.item-row').first()
  await row.locator('.item-price').fill('abc')
  await expect(page.locator('#errors')).toContainText('単価')
  await row.locator('.item-price').fill('10.5')
  await expect(page.locator('#errors')).toContainText('単価')
})

test('HTMLを含む入力がそのままテキストとして表示される（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.fill('#doc-client', '<img src=x onerror="window.__xss=1">')
  await page.fill('#doc-notes', '<script>window.__xss=1</script>')
  await expect(page.locator('#preview')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(await page.locator('#preview img').count()).toBe(0)
})

test('入力内容がリロード後も下書きとして復元される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator('#doc-client')).toHaveValue('株式会社テスト')
  await expect(page.locator('#issuer-reg')).toHaveValue('T1234567890123')
  await expect(page.locator('.item-row').first().locator('.item-name')).toHaveValue('制作費')
})

test('明細を削除して0行になっても空行が残りクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.locator('.remove-item').first().click()
  await expect(page.locator('.item-row')).toHaveCount(1)
})

test('壊れたバックアップファイルはエラーメッセージになる', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-json', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{not json', 'utf-8'),
  })
  await expect(page.locator('#status')).toContainText('JSON')
})

test('別アプリのJSONはバックアップとして受け付けない', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-json', {
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"other","documents":[]}', 'utf-8'),
  })
  await expect(page.locator('#status')).toContainText('バックアップファイルではありません')
})

test('PC幅(1280px)・スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await fillBasic(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflow, `width=${width}`).toBe(false)
  }
})

test('印刷表示では入力フォームが隠れ、書類のみが表示される', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.editor')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await fillBasic(page)
  await expect(page.locator('#grand-total')).toContainText('¥11,000')
  await context.setOffline(false)
})
