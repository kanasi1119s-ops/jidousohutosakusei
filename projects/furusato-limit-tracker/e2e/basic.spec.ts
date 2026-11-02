import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function simulate(page: import('@playwright/test').Page, salary = '5000000') {
  await page.fill('#salaryYen', salary)
  await page.click('#sim-form button[type="submit"]')
}
async function addDonation(page: import('@playwright/test').Page, name: string, amount: string, date = '2026-05-01') {
  await page.fill('#d-name', name)
  await page.fill('#d-date', date)
  await page.fill('#d-amount', amount)
  await page.click('#don-form button[type="submit"]')
}

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限＆記録ノート')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '上限額を試算する' })).toBeVisible()
  await expect(page.getByRole('button', { name: '寄附を追加' })).toBeVisible()
  expect(await page.content()).not.toContain('\uFFFD')
})

test('上限額が表示される', async ({ page }) => {
  await page.goto('/')
  await simulate(page)
  await expect(page.locator('#limit-yen')).toContainText('61,000円')
})

test('全角数字・カンマ付きの入力を受け付ける', async ({ page }) => {
  await page.goto('/')
  await simulate(page, '５，０００，０００')
  await expect(page.locator('#limit-yen')).toContainText('61,000円')
})

test('寄附を追加すると残り枠と合計が更新され、削除できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#year', '2026')
  await simulate(page)
  await addDonation(page, '北海道上士幌町', '30000')
  await expect(page.locator('#t-total')).toContainText('30,000円')
  await expect(page.locator('#t-remain')).toContainText('31,000円')
  await page.getByRole('button', { name: '北海道上士幌町の寄附を削除' }).click()
  await expect(page.locator('#don-body tr')).toHaveCount(0)
})

test('上限超過で警告、6自治体でワンストップ不可の警告', async ({ page }) => {
  await page.goto('/')
  await page.fill('#year', '2026')
  await simulate(page)
  for (const n of ['A市', 'B市', 'C市', 'D市', 'E市', 'F市']) await addDonation(page, n, '20000')
  await expect(page.locator('#t-remain')).toContainText('超えています')
  await expect(page.locator('#t-onestop')).toContainText('6自治体以上')
})

test('再読み込み後もデータが復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#year', '2026')
  await simulate(page, '6000000')
  await addDonation(page, '復元テスト町', '10000')
  await page.reload()
  await expect(page.locator('#salaryYen')).toHaveValue('6000000')
  await expect(page.locator('#don-body')).toContainText('復元テスト町')
})

test('CSVがBOM付きUTF-8で日本語を含み、英数字のファイル名', async ({ page }) => {
  await page.goto('/')
  await addDonation(page, '日本語の町', '12345')
  const p = page.waitForEvent('download')
  await page.click('#export-csv')
  const dl = await p
  expect(dl.suggestedFilename()).toMatch(/^furusato-donations-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await dl.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('自治体名')
  expect(text).toContain('日本語の町')
  expect(text).not.toContain('\uFFFD')
})

test('CSVとJSONのエクスポート→インポート往復', async ({ page }) => {
  await page.goto('/')
  await addDonation(page, '往復町', '5000')
  const p1 = page.waitForEvent('download')
  await page.click('#export-csv')
  const csvPath = (await (await p1).path())!
  const p2 = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = (await (await p2).path())!

  await page.getByRole('button', { name: '往復町の寄附を削除' }).click()
  await expect(page.locator('#don-body tr')).toHaveCount(0)
  await page.setInputFiles('#import-csv-file', csvPath)
  await expect(page.locator('#don-body')).toContainText('往復町')
  await expect(page.locator('#io-msg')).toContainText('1件')

  await page.getByRole('button', { name: '往復町の寄附を削除' }).click()
  await page.setInputFiles('#import-json-file', jsonPath)
  await expect(page.locator('#don-body')).toContainText('往復町')
})
