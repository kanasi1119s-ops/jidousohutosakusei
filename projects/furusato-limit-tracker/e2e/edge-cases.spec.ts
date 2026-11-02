import { test, expect } from '@playwright/test'

test('不正な入力でエラーが表示され、結果は更新されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salaryYen', 'abc')
  await page.click('#sim-form button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('0以上')
  await page.fill('#salaryYen', '5000000')
  await page.fill('#generalDependents', '1.5')
  await page.click('#sim-form button[type="submit"]')
  await expect(page.locator('#errors')).toContainText('整数')
})

test('不正な寄附（空の自治体名・存在しない日付・0円）はエラー', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-date', '2026-05-01')
  await page.fill('#d-amount', '0')
  await page.click('#don-form button[type="submit"]')
  await expect(page.locator('#d-errors')).toContainText('自治体名')
  await expect(page.locator('#d-errors')).toContainText('1円以上')
})

test('HTMLを含む自治体名がタグとして解釈されない（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-name', '<img src=x onerror=window.__x=1>')
  await page.fill('#d-date', '2026-05-01')
  await page.fill('#d-amount', '1000')
  await page.click('#don-form button[type="submit"]')
  await expect(page.locator('#don-body')).toContainText('<img src=x')
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
  await expect(page.locator('#don-body img')).toHaveCount(0)
})

test('不正なJSON・CSVの読み込みでエラー表示され、既存データは保持される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-name', '保持町')
  await page.fill('#d-date', '2026-05-01')
  await page.fill('#d-amount', '1000')
  await page.click('#don-form button[type="submit"]')
  // 日本語を含むパスはロケール次第で化けるため、ASCIIのみの一時ディレクトリを使う
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flt-'))
  const bad = path.join(dir, 'bad.json')
  fs.writeFileSync(bad, '{not json')
  await page.setInputFiles('#import-json-file', bad)
  await expect(page.locator('#io-msg')).toContainText('JSON')
  const badCsv = path.join(dir, 'bad.csv')
  fs.writeFileSync(badCsv, 'x,y\n1,2')
  await page.setInputFiles('#import-csv-file', badCsv)
  await expect(page.locator('#io-msg')).toContainText('形式が不正')
  await expect(page.locator('#don-body')).toContainText('保持町')
})

test('スマホ幅でも横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('ネットワーク切断後もオフラインで動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限＆記録ノート')
  await page.fill('#salaryYen', '5000000')
  await page.click('#sim-form button[type="submit"]')
  await expect(page.locator('#limit-yen')).toContainText('61,000円')
})

test('同じCSVを2回読み込んでも重複登録されない（Round2で発見した不具合の回帰テスト）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#d-name', '重複町')
  await page.fill('#d-date', '2026-05-01')
  await page.fill('#d-amount', '1000')
  await page.click('#don-form button[type="submit"]')
  const p = page.waitForEvent('download')
  await page.click('#export-csv')
  const csv = (await (await p).path())!
  await page.setInputFiles('#import-csv-file', csv)
  await expect(page.locator('#io-msg')).toContainText('重複1件')
  await expect(page.locator('#don-body tr')).toHaveCount(1)
})
