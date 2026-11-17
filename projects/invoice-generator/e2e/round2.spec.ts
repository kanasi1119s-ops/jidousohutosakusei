import { test, expect } from '@playwright/test'

test('375px幅で横スクロール（ページ全体）が発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('不正な数量・単価（文字列）でもクラッシュせず0円扱いでプレビューが出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="単価1"]', 'あいう')
  await expect(page.locator('#doc-total')).toContainText('¥0')
})

test('巨大な金額でも表示が崩れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="単価1"]', '99999999999')
  await expect(page.locator('#doc-total')).toContainText('¥109,999,999,998')
})

test('明細の追加・削除と軽減税率の区分集計', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="単価1"]', '1000')
  await page.click('#add-item')
  await page.fill('[aria-label="単価2"]', '500')
  await page.selectOption('[aria-label="税率2"]', '8')
  await expect(page.locator('#doc')).toContainText('8%対象 税抜合計 ¥500')
  await expect(page.locator('#doc')).toContainText('軽減税率')
  await page.locator('#items-body tr').nth(1).getByRole('button', { name: '削除' }).click()
  await expect(page.locator('#items-body tr')).toHaveCount(1)
  await expect(page.locator('#doc')).not.toContainText('8%対象')
})

test('外部ネットワークへのリクエストが発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url())
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(external).toEqual([])
})

test('宛先に日本語・絵文字・改行を含めても保存→復元で保たれる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#buyerName', '㈱テスト𠮷野家🍣')
  await page.fill('#note', '振込先:\nテスト銀行 普通 1234567')
  await page.click('#save')
  await page.reload()
  await page.locator('#saved button', { hasText: '開く' }).first().click()
  await expect(page.locator('#buyerName')).toHaveValue('㈱テスト𠮷野家🍣')
  await expect(page.locator('#note')).toHaveValue('振込先:\nテスト銀行 普通 1234567')
})
