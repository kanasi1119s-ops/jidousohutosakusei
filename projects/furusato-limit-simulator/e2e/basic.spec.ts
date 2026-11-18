import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出し・ボタン文言が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.getByRole('button', { name: '試算する' })).toBeVisible()
  await expect(page.locator('#limit')).toHaveText('61,029円')
})

test('全角数字・カンマ付きで入力でき、結果が更新される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '６，０００，０００')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit')).not.toHaveText('61,029円')
  await expect(page.locator('#table-body tr')).toHaveCount(15)
})

test('不正入力でエラーが出て結果が隠れる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', 'abc')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('数字')
  await expect(page.locator('#summary')).toBeHidden()
})

test('CSVがBOM付きUTF-8で英数字ファイル名', async ({ page }) => {
  await page.goto('/')
  const p = page.waitForEvent('download')
  await page.click('#export-csv')
  const d = await p
  expect(d.suggestedFilename()).toMatch(/^furusato-limit-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await d.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('寄附上限額の目安')
})

test('設定のエクスポート/インポート往復と再読み込み後の復元', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '4,200,000')
  await page.check('#hasSpouse')
  await page.click('button[type="submit"]')
  const p = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = (await (await p).path())!

  await page.reload()
  await expect(page.locator('#salaryYen')).toHaveValue('4200000')
  await expect(page.locator('#hasSpouse')).toBeChecked()

  await page.fill('#salaryYen', '999')
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fc.setFiles(jsonPath)
  await expect(page.locator('#salaryYen')).toHaveValue('4200000')
})

test('壊れたJSONのインポートでエラー表示', async ({ page }, testInfo) => {
  await page.goto('/')
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{broken')
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fc.setFiles(bad)
  await expect(page.locator('#errors')).toContainText('JSON')
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})

test('小数の扶養人数はエラー（Round 2）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#dependentsGeneral', '1.5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('整数')
})
