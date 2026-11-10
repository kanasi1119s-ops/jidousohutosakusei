import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function add(page: Page, muni: string, amount: string, date = '2026-11-01') {
  await page.fill('#d-date', date)
  await page.fill('#d-muni', muni)
  await page.fill('#d-amount', amount)
  await page.click('#add-btn')
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額＆寄付台帳')
  await expect(page.getByText('登録不要・オフライン対応')).toBeVisible()
  await expect(page.locator('#limit-value')).toContainText('円')
})

test('給与収入を変えると上限額が変わる', async ({ page }) => {
  await page.goto('/')
  const before = await page.locator('#limit-value').textContent()
  await page.fill('#salaryYen', '8,000,000')
  await page.click('#calc-btn')
  const after = await page.locator('#limit-value').textContent()
  expect(after).not.toBe(before)
})

test('不正入力でエラーが出る（全角数字は受け付ける）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', '-1')
  await page.click('#calc-btn')
  await expect(page.locator('#errors')).toContainText('0以上')
  await page.fill('#salaryYen', '５０００００００')
  await page.click('#calc-btn')
  await expect(page.locator('#errors')).toBeEmpty()
})

test('寄付を追加すると合計・残りが更新され、再読み込み後も復元される', async ({ page }) => {
  await page.goto('/')
  await add(page, '北海道東川町', '20000')
  await expect(page.locator('#total')).toContainText('20,000円')
  await expect(page.locator('#remaining')).toContainText('あと')
  await page.reload()
  await expect(page.locator('#rows tr')).toHaveCount(1)
  await expect(page.locator('#rows')).toContainText('北海道東川町')
})

test('ワンストップ特例が6自治体になると警告が出る', async ({ page }) => {
  await page.goto('/')
  for (const m of ['A市', 'B市', 'C市', 'D市', 'E市']) await add(page, m, '1000')
  await expect(page.locator('#onestop-count')).not.toContainText('確定申告が必要')
  await add(page, 'F市', '1000')
  await expect(page.locator('#onestop-count')).toContainText('確定申告が必要')
})

test('不正な寄付はエラー', async ({ page }) => {
  await page.goto('/')
  await add(page, '', 'abc', '2026-02-30')
  await expect(page.locator('#d-errors li')).toHaveCount(3)
})

test('CSVはBOM付きUTF-8で日本語を含み、往復できる', async ({ page }) => {
  await page.goto('/')
  await add(page, '長野県川上村', '15000')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^furusato-donations-\d{4}-\d{2}-\d{2}\.csv$/)
  const p = await download.path()
  const buf = fs.readFileSync(p!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('長野県川上村')
  // 全削除後にインポート
  await page.click('#rows button')
  await expect(page.locator('#rows tr')).toHaveCount(0)
  await page.setInputFiles('#import-file', p!)
  await expect(page.locator('#rows')).toContainText('長野県川上村')
  await expect(page.locator('#import-msg')).toContainText('1件を追加')
})

test('JSONバックアップを往復できる／不正JSONはエラー', async ({ page }) => {
  await page.goto('/')
  await add(page, '佐賀県上峰町', '12000')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const p = await (await dl).path()
  await page.click('#rows button')
  await page.setInputFiles('#import-file', p!)
  await expect(page.locator('#rows')).toContainText('佐賀県上峰町')
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2}') })
  await expect(page.locator('#import-msg')).toContainText('不正')
})

test('XSS文字列は無害化されて表示される', async ({ page }) => {
  await page.goto('/')
  await add(page, '<img src=x onerror=window.__x=1>', '1000')
  await expect(page.locator('#rows')).toContainText('<img')
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
})

test('オフラインでも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // SW制御下に入る
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額＆寄付台帳')
  await add(page, 'オフライン町', '3000')
  await expect(page.locator('#rows')).toContainText('オフライン町')
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('全角数字の寄付日・金額でも追加できる', async ({ page }) => {
  await page.goto('/')
  await add(page, '全角町', '１，０００', '２０２６-１１-０１')
  await expect(page.locator('#rows')).toContainText('1,000円')
  await expect(page.locator('#rows')).toContainText('2026-11-01')
})
