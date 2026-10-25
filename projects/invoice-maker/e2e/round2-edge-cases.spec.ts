import { test, expect } from '@playwright/test'

test('巨大な金額・不正な数量はエラーになりクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#sellerName', 'a')
  await page.fill('#clientName', 'b')
  await page.fill('[aria-label="品名 1"]', 'x')
  await page.fill('[aria-label="単価 1"]', '99999999999999')
  await expect(page.locator('#errors')).toContainText('大きすぎます')
  await page.fill('[aria-label="単価 1"]', '100')
  await page.fill('[aria-label="数量 1"]', 'abc')
  await expect(page.locator('#errors')).toContainText('数量')
  await page.fill('[aria-label="数量 1"]', '-1')
  await expect(page.locator('#errors')).toContainText('数量')
  await page.fill('[aria-label="数量 1"]', '2')
  await expect(page.locator('#errors')).not.toContainText('数量')
})

test('壊れたJSONの読み込みはエラーメッセージを出し、既存データを壊さない', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-json', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"foo": '),
  })
  await expect(page.locator('#status')).toContainText('読み込みに失敗')
  await page.setInputFiles('#import-json', {
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"foo": 1}'),
  })
  await expect(page.locator('#status')).toContainText('バックアップファイルではありません')
})

test('入力値に含まれるHTMLは文字列として表示され、実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror=alert(1)>')
  await expect(page.locator('.client')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.doc img')).toHaveCount(0)
})

test('明細の削除・最後の1行の削除でも行が残る', async ({ page }) => {
  await page.goto('/')
  await page.click('#add-row')
  await expect(page.locator('.items tbody tr')).toHaveCount(2)
  await page.click('[aria-label="明細2を削除"]')
  await page.click('[aria-label="明細1を削除"]')
  await expect(page.locator('.items tbody tr')).toHaveCount(1)
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('PC幅では入力とプレビューが並ぶ', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const l = await page.locator('.editor').boundingBox()
  const r = await page.locator('#preview').boundingBox()
  expect(r!.x).toBeGreaterThan(l!.x + l!.width - 1)
})

test('オフライン（サーバー停止相当）でも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await page.fill('#clientName', '株式会社オフライン')
  await expect(page.locator('.client')).toContainText('株式会社オフライン')
})
