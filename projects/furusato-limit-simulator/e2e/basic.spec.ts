import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#summary')).toBeVisible()
  await expect(page.locator('#limit-main')).toContainText('控除上限額の目安')
})

test('年収500万円・単身で6万円台前半の目安が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '5000000')
  await page.fill('#socialInsuranceYen', '')
  await page.fill('#extraDeductionYen', '0')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit-main')).toContainText(/6[01],\d00円/)
})

test('全角数字・カンマ付きの入力を受け付ける', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '６，０００，０００円')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toHaveText('')
  await expect(page.locator('#limit-main')).toContainText('控除上限額の目安')
})

test('不正な入力でエラーメッセージが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', 'abc')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('給与収入')
  await expect(page.locator('#summary')).toBeHidden()
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^furusato-limit-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect(buf[0]).toBe(0xef)
  expect(buf[1]).toBe(0xbb)
  expect(buf[2]).toBe(0xbf)
  expect(buf.toString('utf-8')).toContain('控除上限額の目安')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '7000000')
  await page.fill('#donatedYen', '30000')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = await (await downloadPromise).path()

  await page.reload()
  await page.fill('#salaryYen', '999')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath!)
  await expect(page.locator('#salaryYen')).toHaveValue('7000000')
  await expect(page.locator('#donatedYen')).toHaveValue('30000')
})
