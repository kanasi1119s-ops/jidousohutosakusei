import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 控除上限額シミュレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#summary')).toBeVisible()
  await expect(page.locator('#limit')).toContainText('控除上限額の目安')
})

test('入力すると試算結果が更新され、年収が高いほど上限が増える', async ({ page }) => {
  const read = async () =>
    Number(((await page.locator('#limit').textContent()) ?? '').replace(/[^0-9]/g, ''))
  await page.goto('/')
  await page.fill('#salaryYen', '4000000')
  await page.click('button[type="submit"]')
  const low = await read()
  await page.fill('#salaryYen', '8000000')
  await page.click('button[type="submit"]')
  const high = await read()
  expect(low).toBeGreaterThan(0)
  expect(high).toBeGreaterThan(low)
  await expect(page.locator('#result-body tr')).toHaveCount(9)
})

test('異常な入力でエラーメッセージが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '-5')
  await page.click('button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
})

test('CSVエクスポートがBOM付きUTF-8で日本語を含み、英数字のファイル名', async ({ page }) => {
  await page.goto('/')
  await page.click('button[type="submit"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^furusato-limit-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('ふるさと納税 控除上限額の目安')
})

test('設定のエクスポート/インポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '6300000')
  await page.selectOption('#spouse', 'deduction')
  await page.fill('#dependents', '2')
  await page.click('button[type="submit"]')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = await (await dl).path()

  await page.reload()
  await page.fill('#salaryYen', '999')
  await page.selectOption('#spouse', 'none')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath!)
  await expect(page.locator('#salaryYen')).toHaveValue('6300000')
  await expect(page.locator('#spouse')).toHaveValue('deduction')
  await expect(page.locator('#dependents')).toHaveValue('2')
})

test('不正なJSONのインポートはエラー表示になる', async ({ page }) => {
  await page.goto('/')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') })
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
})

test('入力が再読み込み後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '7123000')
  await page.click('button[type="submit"]')
  await page.reload()
  await expect(page.locator('#salaryYen')).toHaveValue('7123000')
})

test('オフライン（サーバー停止相当）でも動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload() // SWに制御されたページにする
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 控除上限額シミュレーター')
  await page.fill('#salaryYen', '5500000')
  await page.click('button[type="submit"]')
  await expect(page.locator('#limit')).toContainText('控除上限額の目安')
})
