import { expect, test } from '@playwright/test'

test('横スクロールが発生しない（明細入力後）', async ({ page }) => {
  await page.goto('/')
  await page.locator('.li-desc').first().fill('とても長い品名'.repeat(20))
  await page.locator('.li-price').first().fill('1234567')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('巨大な数値はエラーになりクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.locator('.li-desc').first().fill('x')
  await page.locator('.li-qty').first().fill('999999')
  await page.locator('.li-price').first().fill('999999999')
  await expect(page.locator('#errors')).toContainText('大きすぎ')
  await expect(page.locator('#sum-body')).toContainText('合計（税込）')
})

test('明細は100行まで。行を全削除しても空行が1つ残る', async ({ page }) => {
  await page.goto('/')
  for (let i = 0; i < 105; i++) await page.click('#add-line')
  await expect(page.locator('#items-body tr')).toHaveCount(100)
  while ((await page.locator('#items-body tr').count()) > 1) await page.locator('.li-del').first().click()
  await page.locator('.li-del').first().click()
  await expect(page.locator('#items-body tr')).toHaveCount(1)
})

test('書類の種類を領収書にすると表題と文言が変わる', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('#docType', 'receipt')
  await expect(page.locator('#preview h3')).toHaveText('領収書')
  await expect(page.locator('#preview')).toContainText('上記正に領収いたしました')
})

test('印刷表示ではプレビューだけが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '株式会社サンプル')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#preview')).toBeVisible()
  await expect(page.locator('#items-body')).toBeHidden()
  await expect(page.locator('h1')).toBeHidden()
})

test('削除した書類は一覧から消える', async ({ page }) => {
  await page.goto('/')
  await page.fill('#docNumber', 'DEL-1')
  await page.click('#save-doc')
  await expect(page.locator('#saved-list li')).toContainText('DEL-1')
  page.once('dialog', (d) => d.accept())
  await page.locator('.delete-doc').first().click()
  await expect(page.locator('#saved-list')).toContainText('保存した書類はまだありません')
})

test('複製すると番号が空になり別IDで保存できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#docNumber', 'A-1')
  await page.click('#save-doc')
  await page.click('#copy-doc')
  await expect(page.locator('#docNumber')).toHaveValue('')
  await page.fill('#docNumber', 'A-2')
  await page.click('#save-doc')
  await expect(page.locator('#saved-list li')).toHaveCount(2)
})
