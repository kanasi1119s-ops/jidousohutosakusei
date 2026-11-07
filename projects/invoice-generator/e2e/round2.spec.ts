import { expect, test } from '@playwright/test'

test('巨大な数値入力は無視され、合計がNaN/Infinityにならない', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('単価 1').fill('99999999999999999999999')
  const text = await page.locator('#preview').innerText()
  expect(text).not.toMatch(/NaN|Infinity|e\+/)
})

test('印刷表示では入力フォームが隠れ、請求書だけが表示される', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('請求先名称').fill('印刷テスト')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.form')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
})

test('明細を200行まで追加でき、それ以上は追加されない', async ({ page }) => {
  await page.goto('/')
  for (let i = 0; i < 205; i++) await page.locator('#add-item').click()
  await expect(page.locator('#items-body tr')).toHaveCount(200)
  await expect(page.locator('#messages')).toContainText('200行まで')
})

test('最後の明細を削除しても空行が1つ残る', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '明細 1 を削除' }).click()
  await expect(page.locator('#items-body tr')).toHaveCount(1)
})
