import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出し・ボタン・免責が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 控除上限額シミュレーター')
  await expect(page.getByRole('button', { name: '試算する' })).toBeVisible()
  await expect(page.getByText('免責事項')).toBeVisible()
  await expect(page.locator('#limit')).toHaveText('61,000円')
})

test('全角数字・カンマ入力でも試算できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#annualSalaryYen', '５，０００，０００')
  await page.fill('#alreadyDonatedYen', '30000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit')).toHaveText('61,000円')
  await expect(page.locator('#remaining')).toContainText('31,000円')
})

test('不正入力でエラーが表示され結果が隠れる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#annualSalaryYen', 'abc')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('給与収入')
  await expect(page.locator('#summary')).toBeHidden()
})

test('寄附済み額が上限を超えると警告文が出る', async ({ page }) => {
  await page.goto('/')
  await page.fill('#alreadyDonatedYen', '100000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#remaining')).toContainText('超えています')
})

test('保存→再読み込みで入力が復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#annualSalaryYen', '7000000')
  await page.selectOption('#spouse', 'deduction')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#annualSalaryYen')).toHaveValue('7000000')
  await expect(page.locator('#spouse')).toHaveValue('deduction')
})

test('CSVはBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^furusato-limit-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('控除上限額の目安(円)')
})

test('JSONエクスポート→インポートの往復', async ({ page }) => {
  await page.goto('/')
  await page.fill('#annualSalaryYen', '6000000')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const file = (await (await dl).path())!
  await page.fill('#annualSalaryYen', '3000000')
  await page.click('button[type="submit"]')
  await page.setInputFiles('#import-file', file)
  await expect(page.locator('#annualSalaryYen')).toHaveValue('6000000')
})

test('不正なJSONのインポートはエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('#import-file', {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"foo":1}'),
  })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('オフラインでも動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload() // SWが制御下に入ってから
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 控除上限額シミュレーター')
  await page.fill('#annualSalaryYen', '4000000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit')).not.toHaveText('')
})
