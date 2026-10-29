import { test, expect } from '@playwright/test'

test('給与収入が空欄のときはエラーになり0円と誤表示しない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('給与収入')
  await expect(page.locator('#summary')).toBeHidden()
})

test('全角数字で入力しても半角として解釈され試算できる', async ({ page }) => {
  await page.goto('/')
  await page.locator('#salaryYen').fill('')
  await page.locator('#salaryYen').pressSequentially('５０００００００')
  await page.click('button[type="submit"]')
  await expect(page.locator('#salaryYen')).toHaveValue('50000000')
  await expect(page.locator('#limit')).toContainText('控除上限額の目安')
})

test('巨大な入力（1億円超）はエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '999999999999')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('1億円以下')
})

test('社会保険料が年収を超えてもクラッシュせず0円以上で表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '3000000')
  await page.fill('#socialInsuranceYen', '99999999')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit')).toContainText('0円')
})

test('扶養人数が小数のときエラーになる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#dependents', '1.5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('整数')
})

test('二重クリックしても結果表示が崩れない', async ({ page }) => {
  await page.goto('/')
  await page.dblclick('button[type="submit"]')
  await expect(page.locator('#result-body tr')).toHaveCount(9)
})

test('PC幅(1280px)でもレイアウト崩れ（横スクロール）がない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
})
