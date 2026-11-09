import { test, expect } from '@playwright/test'

test('宛名にHTMLを入力してもスクリプトは実行されず文字として表示される', async ({ page }) => {
  let dialogs = 0
  page.on('dialog', (d) => { dialogs++; void d.dismiss() })
  await page.goto('/')
  await page.fill('#customer', '<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview .to')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(dialogs).toBe(0)
})

test('不正な数量・単価・登録番号でエラーが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-reg', 'T12')
  await page.fill('[aria-label="数量1"]', 'abc')
  await page.fill('[aria-label="単価1"]', 'xyz')
  const msg = page.locator('#messages')
  await expect(msg).toContainText('登録番号は')
  await expect(msg).toContainText('数量')
  await expect(msg).toContainText('単価')
})

test('登録番号が空だと警告（適格請求書の要件を満たさない旨）が出る', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#messages')).toContainText('登録番号が未入力')
})

test('明細の削除ができ、全削除するとエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await page.click('[data-remove="0"]')
  await expect(page.locator('#items-body tr')).toHaveCount(0)
  await expect(page.locator('#messages')).toContainText('明細を1行以上')
})

test('巨大な金額でもレイアウトが崩れず横スクロールが出ない', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="単価1"]', '99999999999')
  await expect(page.locator('#preview')).toContainText('¥99,999,999,999')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
})

test('壊れたJSONの読み込みはエラーメッセージを出しデータを壊さない', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.fill('#issuer-name', '山田デザイン')
  await page.fill('#customer', '株式会社サンプル')
  await page.fill('[aria-label="品名1"]', 'ロゴ制作')
  await page.fill('[aria-label="単価1"]', '1000')
  await page.click('#save-invoice')
  await expect(page.locator('#saved-body tr')).toHaveCount(1)
  const fs = await import('node:fs')
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{not json', 'utf-8')
  await page.setInputFiles('#import-file', bad)
  await expect(page.locator('#status')).toContainText('JSON')
  await expect(page.locator('#saved-body tr')).toHaveCount(1)
})

test('オフライン（サーバー停止相当）でも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload() // SW制御下に入れる
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書ジェネレーター')
  await page.fill('#customer', 'オフライン商事')
  await expect(page.locator('#preview')).toContainText('オフライン商事 御中')
})

test('外部ドメインへの通信が発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1')  && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()) })
  await page.goto('/')
  await page.fill('#customer', 'テスト')
  expect(external).toEqual([])
})

test('スマホ幅でも横スクロールが発生しない（通常入力時）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-name', '山田デザイン')
  await page.fill('#customer', '株式会社サンプル')
  await page.fill('[aria-label="単価1"]', '10000')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})
