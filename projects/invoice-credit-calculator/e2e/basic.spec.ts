import { test, expect } from '@playwright/test'
import fs from 'node:fs'

async function add(page: import('@playwright/test').Page, date: string, supplier: string, amount: string, type = 'unqualified', rate = '10') {
  await page.fill('#f-date', date)
  await page.fill('#f-supplier', supplier)
  await page.fill('#f-amount', amount)
  await page.selectOption('#f-rate', rate)
  await page.selectOption('#f-type', type)
  await page.click('#add-btn')
}

test('日本語の見出しと免責事項が正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('インボイス経過措置 仕入税額控除計算機')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('.disclaimer')).toContainText('免責事項')
})

test('2026年10月1日の免税事業者からの仕入れは70%控除になる', async ({ page }) => {
  await page.goto('/')
  await add(page, '2026-10-01', 'テスト商店', '11000')
  await expect(page.locator('#result-body tr')).toHaveCount(1)
  await expect(page.locator('#result-body tr')).toContainText('70%')
  await expect(page.locator('#result-body tr')).toContainText('700円')
  await expect(page.locator('#total-line')).toContainText('700円')
})

test('2026年9月30日は80%、適格事業者は100%', async ({ page }) => {
  await page.goto('/')
  await add(page, '2026-09-30', 'A', '11000')
  await add(page, '2026-10-01', 'B', '11000', 'qualified')
  await expect(page.locator('#result-body tr').nth(0)).toContainText('80%')
  await expect(page.locator('#result-body tr').nth(1)).toContainText('100%')
})

test('不正な入力はエラー表示になり追加されない', async ({ page }) => {
  await page.goto('/')
  await add(page, '2026-10-01', 'X', 'abc')
  await expect(page.locator('#errors')).toContainText('税込金額')
  await expect(page.locator('#result-body tr')).toHaveCount(0)
})

test('CSVエクスポートがBOM付きUTF-8で日本語を含む', async ({ page }) => {
  await page.goto('/')
  await add(page, '2026-10-01', '日本語商店', '11000')
  const p = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await p
  expect(download.suggestedFilename()).toMatch(/^invoice-credit-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('控除可能額')
  expect(text).toContain('日本語商店')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('CSVエクスポート→インポートの往復と、ひな形のインポート', async ({ page }) => {
  await page.goto('/')
  const t = page.waitForEvent('download')
  await page.click('#export-template')
  const tpl = await t
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-csv')])
  await chooser.setFiles((await tpl.path())!)
  await expect(page.locator('#result-body tr')).toHaveCount(3)
  await expect(page.locator('#io-errors')).toContainText('3件を取り込みました')
  await expect(page.locator('#result-body')).toContainText('サンプル商店')
})

test('JSONバックアップの往復と削除', async ({ page }) => {
  await page.goto('/')
  await add(page, '2026-10-01', '復元テスト', '22000')
  const d = page.waitForEvent('download')
  await page.click('#export-json')
  const file = await d
  page.once('dialog', (dlg) => dlg.accept())
  await page.click('#clear-all')
  await expect(page.locator('#result-body tr')).toHaveCount(0)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles((await file.path())!)
  await expect(page.locator('#result-body')).toContainText('復元テスト')
})

test('スマホ幅(375px)とPC幅(1280px)で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await add(page, '2026-10-01', '幅テスト', '11000')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflow).toBe(false)
  }
})
