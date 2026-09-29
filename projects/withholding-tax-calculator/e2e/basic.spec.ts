import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function add(page: import('@playwright/test').Page, amount: string, opts: { separated?: boolean; label?: string } = {}) {
  if (opts.label) await page.fill('#label', opts.label)
  await page.fill('#amount', amount)
  if (opts.separated === false) await page.uncheck('#taxSeparated')
  await page.click('#add')
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('源泉徴収税額かんたん計算')
  await expect(page.getByText('登録不要').first()).toBeVisible()
  await expect(page.locator('#add')).toHaveText('明細に追加して計算')
})

test('10万円の報酬（税抜区分あり）で源泉徴収10,210円になる', async ({ page }) => {
  await page.goto('/')
  await add(page, '100000', { label: 'ロゴ制作' })
  await expect(page.locator('#result-body tr')).toHaveCount(1)
  await expect(page.locator('#result-body')).toContainText('ロゴ制作')
  await expect(page.locator('#totals')).toContainText('源泉徴収税額 10,210円')
  await expect(page.locator('#totals')).toContainText('支払額 99,790円')
})

test('全角数字を受け付け、不正入力にはエラーを表示する', async ({ page }) => {
  await page.goto('/')
  await add(page, '１００，０００')
  await expect(page.locator('#totals')).toContainText('10,210円')
  await add(page, 'abc')
  await expect(page.locator('#errors')).toContainText('数字')
  await add(page, '0')
  await expect(page.locator('#errors')).toContainText('1円以上')
})

test('100万円超は超過分20.42%で計算される', async ({ page }) => {
  await page.goto('/')
  await add(page, '2000000')
  await expect(page.locator('#totals')).toContainText('源泉徴収税額 306,300円')
})

test('HTMLを含む項目名はエスケープされ、削除・再読み込みで状態が保持される', async ({ page }) => {
  await page.goto('/')
  await add(page, '10000', { label: '<b>x</b>' })
  await expect(page.locator('#result-body b')).toHaveCount(0)
  await expect(page.locator('#result-body')).toContainText('<b>x</b>')
  await page.reload()
  await expect(page.locator('#result-body tr')).toHaveCount(1)
  await page.click('#result-body button.danger')
  await expect(page.locator('#result-body tr')).toHaveCount(0)
  await expect(page.locator('#empty')).toBeVisible()
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含み、ファイル名は英数字', async ({ page }) => {
  await page.goto('/')
  await add(page, '50000', { label: 'コーディング' })
  const p = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await p
  expect(download.suggestedFilename()).toMatch(/^withholding-tax-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf-8')
  expect(text).toContain('項目名')
  expect(text).toContain('コーディング')
  expect(text).not.toContain(String.fromCharCode(0xfffd))
})

test('JSONエクスポート→全削除→インポートで往復できる', async ({ page }) => {
  await page.goto('/')
  await add(page, '30000', { label: '往復テスト' })
  const p = page.waitForEvent('download')
  await page.click('#export-json')
  const jsonPath = (await (await p).path())!
  await page.click('#clear')
  await expect(page.locator('#result-body tr')).toHaveCount(0)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(jsonPath)
  await expect(page.locator('#result-body')).toContainText('往復テスト')
})

test('不正なJSONのインポートはエラー表示', async ({ page }) => {
  await page.goto('/')
  const bad = path.join(os.tmpdir(), `wtc-bad-${process.pid}-${Date.now()}.json`)
  fs.writeFileSync(bad, '{"entries":[{"id":1}]}')
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await chooser.setFiles(bad)
  await expect(page.locator('#errors')).toContainText('形式が不正')
})

test('スマホ幅(375px)で横スクロールが発生しない（明細あり）', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await add(page, '123456789', { label: 'とても長い項目名とても長い項目名とても長い項目名' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(overflow).toBe(false)
})

test('オフラインでも再読み込み後に動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('源泉徴収税額かんたん計算')
  await add(page, '100000')
  await expect(page.locator('#totals')).toContainText('10,210円')
})
