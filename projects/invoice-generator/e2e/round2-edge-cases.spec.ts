import { test, expect } from '@playwright/test'

test('登録番号の形式エラーと未入力が警告される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#warnings')).toContainText('登録番号が未入力')
  await page.fill('#issuer-reg', 'T123')
  await expect(page.locator('#warnings')).toContainText('形式が正しくありません')
  await page.fill('#issuer-reg', 'Ｔ１２３４５６７８９０１２３')
  await expect(page.locator('#warnings')).not.toContainText('登録番号')
  await expect(page.locator('#sheet')).toContainText('登録番号: T1234567890123')
})

test('数値でない入力は警告され0として扱われる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#line-0-unitPrice', 'abc')
  await expect(page.locator('#warnings')).toContainText('数値として読めない')
  await expect(page.locator('#line-0-unitPrice')).toHaveClass(/invalid/)
  await expect(page.locator('#sheet-total')).toHaveText('¥0')
  await page.fill('#line-0-unitPrice', '500')
  await expect(page.locator('#warnings')).not.toContainText('数値として読めない')
})

test('HTMLタグを含む入力がそのまま文字として表示される（XSSにならない）', async ({ page }) => {
  let dialog = false
  page.on('dialog', () => { dialog = true })
  await page.goto('/')
  await page.fill('#inv-client', '<img src=x onerror=alert(1)>')
  await page.fill('#line-0-name', '<script>alert(2)</script>')
  await expect(page.locator('#sheet')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('#sheet img')).toHaveCount(0)
  expect(dialog).toBe(false)
})

test('巨大な金額でも画面が壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#line-0-qty', '999999')
  await page.fill('#line-0-unitPrice', '999999999')
  await expect(page.locator('#sheet-total')).toContainText('¥')
  await expect(page.locator('#sheet-total')).not.toContainText('NaN')
})

test('壊れたJSONの読み込みは安全に拒否される', async ({ page }, testInfo) => {
  const fs = await import('node:fs')
  const p = testInfo.outputPath('broken.json')
  fs.writeFileSync(p, '{ broken', 'utf-8')
  await page.goto('/')
  await page.setInputFiles('#import-json', p)
  await expect(page.locator('#message')).toContainText('読み込めませんでした')
})

test('明細を追加・削除でき、最後の1行は空に戻る', async ({ page }) => {
  await page.goto('/')
  await page.click('#add-line')
  await expect(page.locator('#lines-body tr')).toHaveCount(2)
  await page.click('button[aria-label="明細2を削除"]')
  await expect(page.locator('#lines-body tr')).toHaveCount(1)
  await page.fill('#line-0-name', 'あ')
  await page.click('button[aria-label="明細1を削除"]')
  await expect(page.locator('#lines-body tr')).toHaveCount(1)
  await expect(page.locator('#line-0-name')).toHaveValue('')
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('外部ホストへの通信が発生しない', async ({ page, baseURL }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(baseURL!) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
  })
  await page.goto('/')
  await page.fill('#inv-client', 'テスト')
  await page.waitForTimeout(500)
  expect(external).toEqual([])
})

test('ネットワークを遮断してもコア機能が動く（オフライン）', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // SWが制御するまで一度リロード
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書ジェネレーター')
  await page.fill('#line-0-unitPrice', '2000')
  await expect(page.locator('#sheet-total')).toHaveText('¥2,200')
  await context.setOffline(false)
})
