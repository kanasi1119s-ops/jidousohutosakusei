import { expect, test } from '@playwright/test'

test('巨大な数値を入力しても合計が壊れない（NaN/指数表記にならない）', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('数量 1').fill('9'.repeat(30))
  await page.getByLabel('単価 1').fill('9'.repeat(30))
  const text = await page.locator('#preview').innerText()
  expect(text).not.toMatch(/NaN|e\+|Infinity/)
  expect(text).toContain('合計（税込）')
})

test('全角数字・カンマ付き数量/単価、不正文字は0扱い', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('数量 1').fill('２')
  await page.getByLabel('単価 1').fill('１，５００')
  await expect(page.locator('#preview')).toContainText('¥3,300')
  await page.getByLabel('単価 1').fill('あいう')
  await expect(page.locator('#preview')).toContainText('¥0')
})

test('明細の追加・削除（最後の1行は残る）と連打', async ({ page }) => {
  await page.goto('/')
  const add = page.getByRole('button', { name: '＋ 明細を追加' })
  await add.click()
  await add.click()
  await expect(page.getByLabel(/^品名 \d+$/)).toHaveCount(3)
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^明細 1 を削除$/ }).click()
  await expect(page.getByLabel(/^品名 \d+$/)).toHaveCount(1)
})

test('請求先が空でもプレビューが崩れず、改行はそのまま表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#f-bank', '○○銀行 △△支店\n普通 1234567')
  await expect(page.locator('#preview')).toContainText('（請求先未入力） 御中')
  await expect(page.locator('#preview')).toContainText('○○銀行 △△支店')
})

test('印刷用CSS: 印刷時は入力フォームが非表示でプレビューのみ表示される', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#form')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})
