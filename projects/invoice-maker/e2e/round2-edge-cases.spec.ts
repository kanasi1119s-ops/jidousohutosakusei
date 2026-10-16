import { test, expect } from '@playwright/test'

test('全角数字・カンマ入りの数値を半角として計算する', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', 'A社')
  await page.fill('[data-k="description"]', '品')
  await page.fill('[data-k="quantity"]', '２')
  await page.fill('[data-k="unitPrice"]', '１，０００')
  await expect(page.locator('#preview .inv-total')).toContainText('¥2,200')
})

test('XSS文字列を入力してもスクリプトが実行されず文字として表示される', async ({ page }) => {
  let dialog = false
  page.on('dialog', () => {
    dialog = true
  })
  await page.goto('/')
  await page.fill('#f-client', '<img src=x onerror=alert(1)>')
  await page.fill('[data-k="description"]', '<script>alert(2)</script>')
  await page.fill('[data-k="unitPrice"]', '100')
  await expect(page.locator('#preview')).toContainText('<img src=x onerror=alert(1)> 御中')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(dialog).toBe(false)
})

test('巨大な数値でも画面が壊れずエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', 'A社')
  await page.fill('[data-k="description"]', '品')
  await page.fill('[data-k="quantity"]', '99999999')
  await page.fill('[data-k="unitPrice"]', '99999999')
  await page.click('#btn-save')
  await expect(page.locator('#errors')).toContainText('大きすぎます')
})

test('負の数量・登録番号の形式不正でエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', 'A社')
  await page.fill('[data-k="description"]', '品')
  await page.fill('[data-k="quantity"]', '-1')
  await page.click('#btn-save')
  await expect(page.locator('#errors')).toContainText('0以上')
  await page.fill('[data-k="quantity"]', '1')
  await page.locator('#issuer-card summary').click()
  await page.fill('#i-reg', 'T123')
  await page.click('#btn-save')
  await expect(page.locator('#errors')).toContainText('登録番号')
})

test('登録番号は全角入力でも半角T+13桁に正規化されてプレビューに出る', async ({ page }) => {
  await page.goto('/')
  await page.locator('#issuer-card summary').click()
  await page.fill('#i-reg', 'Ｔ１２３４５６７８９０１２３')
  await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
})

test('明細の二重クリック追加・全削除でも最低1行残る', async ({ page }) => {
  await page.goto('/')
  // 行追加でボタン位置が下がるため、実際の2連打を再現するにはDOM上で連続クリックする
  await page.evaluate(() => {
    const b = document.getElementById('add-line') as HTMLButtonElement
    b.click()
    b.click()
  })
  await expect(page.locator('#lines-body tr')).toHaveCount(3)
  for (let i = 0; i < 5; i++) {
    await page.locator('#lines-body tr').first().locator('[data-del]').click()
  }
  await expect(page.locator('#lines-body tr')).toHaveCount(1)
})

test('源泉徴収を有効にすると差引後のご請求額になる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-client', 'A社')
  await page.fill('[data-k="description"]', '原稿料')
  await page.fill('[data-k="unitPrice"]', '500000')
  await page.check('#f-withholding')
  await expect(page.locator('#preview .inv-sum')).toContainText('-¥51,050')
  await expect(page.locator('#preview .inv-total')).toContainText('¥498,950')
})

test('スマホ幅・PC幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.fill('#f-client', 'A社')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  }
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await page.fill('#f-client', 'オフライン社')
  await page.fill('[data-k="description"]', '品')
  await page.fill('[data-k="unitPrice"]', '1000')
  await expect(page.locator('#preview .inv-total')).toContainText('¥1,100')
  await page.click('#btn-save')
  await expect(page.locator('#status')).toHaveText('保存しました。')
  await context.setOffline(false)
})

test('外部ドメインへの通信が一切発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) external.push(r.url())
  })
  await page.goto('/')
  await page.fill('#f-client', 'A社')
  await page.waitForTimeout(500)
  expect(external).toEqual([])
})
