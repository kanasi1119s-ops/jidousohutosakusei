import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '上限額を試算する' })).toBeVisible()
  await expect(page.getByRole('button', { name: '寄附を追加' })).toBeVisible()
})

test('年収500万円・独身の上限額は約58,000円', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '5000000')
  await page.click('button:has-text("上限額を試算する")')
  await expect(page.locator('#limit')).toContainText('58,000円')
})

test('寄附を追加すると残り枠が表示され、削除できる', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("上限額を試算する")')
  await page.fill('#d-date', '2026-11-05')
  await page.fill('#d-muni', '札幌市')
  await page.fill('#d-amount', '20000')
  await page.click('#add-donation')
  await expect(page.locator('#donation-body tr')).toHaveCount(1)
  await expect(page.locator('#tracker-status')).toContainText('残り枠: 38,000円')
  await page.click('[data-delete]')
  await expect(page.locator('#donation-body tr')).toHaveCount(0)
})

test('寄附一覧CSVがBOM付きUTF-8で日本語を含む', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-date', '2026-11-05')
  await page.fill('#d-muni', '札幌市')
  await page.fill('#d-amount', '10000')
  await page.click('#add-donation')
  const p = page.waitForEvent('download')
  await page.click('#export-csv')
  const dl = await p
  expect(dl.suggestedFilename()).toMatch(/^furusato-donations-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('札幌市')
})

test('バックアップのエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '7000000')
  await page.click('button:has-text("上限額を試算する")')
  await page.fill('#d-date', '2026-11-05')
  await page.fill('#d-muni', '函館市')
  await page.fill('#d-amount', '15000')
  await page.click('#add-donation')
  const p = page.waitForEvent('download')
  await page.click('#export-json')
  const path = (await (await p).path())!
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('#salaryYen')).toHaveValue('5000000')
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fc.setFiles(path)
  await expect(page.locator('#salaryYen')).toHaveValue('7000000')
  await expect(page.locator('#donation-body')).toContainText('函館市')
})

test('リロード後も入力と寄附が復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '6000000')
  await page.click('button:has-text("上限額を試算する")')
  await page.fill('#d-date', '2026-11-05')
  await page.fill('#d-muni', '旭川市')
  await page.fill('#d-amount', '5000')
  await page.click('#add-donation')
  await page.reload()
  await expect(page.locator('#salaryYen')).toHaveValue('6000000')
  await expect(page.locator('#donation-body')).toContainText('旭川市')
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.click('button:has-text("上限額を試算する")')
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(over).toBe(false)
})
