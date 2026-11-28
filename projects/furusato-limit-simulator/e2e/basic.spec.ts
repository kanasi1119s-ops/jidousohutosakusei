import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出し・ラベル・免責が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.getByText('給与収入（年収・額面・円）')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ご利用にあたって（免責）' })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toContain('\uFFFD')
})

test('入力すると結果が更新され、配偶者ありで下がる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salary', '6000000')
  const before = await page.locator('#limit').innerText()
  expect(before).toMatch(/^[\d,]+円$/)
  await page.selectOption('#spouse', 'spouse')
  const after = await page.locator('#limit').innerText()
  expect(after).not.toBe(before)
  const n = (s: string) => Number(s.replace(/[,円]/g, ''))
  expect(n(after)).toBeLessThan(n(before))
  await expect(page.locator('#quick tbody tr')).toHaveCount(11)
})

test('全角数字でも入力できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salary', '６，０００，０００')
  await expect(page.locator('#input-error')).toBeHidden()
  await expect(page.locator('#limit')).toContainText('円')
})

test('寄附予定額が上限を超えると警告が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#planned', '1000000')
  await expect(page.locator('#donation-status')).toContainText('超えています')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含み、ファイル名が英数字', async ({ page }) => {
  await page.goto('/')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-csv')])
  expect(download.suggestedFilename()).toMatch(/^furusato-limit-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('控除上限額の目安(円)')
})
