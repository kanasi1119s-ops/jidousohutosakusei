import { test, expect } from '@playwright/test'

test('日本語の見出しと主要タブが表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('適格請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('button[data-tab="invoice"]')).toBeVisible()
})

test('事業者情報を保存するとリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="profile"]')
  await page.fill('#businessName', 'サンプル商店')
  await page.fill('#registrationNumber', 'T1234567890123')
  await page.fill('#address', '東京都千代田区1-1-1')
  await page.fill('#bankInfo', 'サンプル銀行 本店 普通1234567')
  await page.click('#profile-form button[type="submit"]')
  await expect(page.locator('#profile-errors')).toHaveText('保存しました。')

  await page.reload()
  await page.click('button[data-tab="profile"]')
  await expect(page.locator('#businessName')).toHaveValue('サンプル商店')
  await expect(page.locator('#registrationNumber')).toHaveValue('T1234567890123')
})

test('請求書を作成すると税率ごとの内訳が自動計算され、履歴に保存される', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')

  await page.fill('#invoiceClientName', '株式会社テスト取引先')
  await page.fill('#issueDate', '2026-09-27')

  await page.fill('[data-field="name"][data-index="0"]', '設計費')
  await page.fill('[data-field="quantity"][data-index="0"]', '1')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '100000')

  await page.click('#add-item-row')
  await page.fill('[data-field="name"][data-index="1"]', '会議費')
  await page.fill('[data-field="quantity"][data-index="1"]', '1')
  await page.fill('[data-field="unitPriceYen"][data-index="1"]', '1000')
  await page.selectOption('[data-field="taxRate"][data-index="1"]', '8')

  await expect(page.locator('#invoice-totals')).toContainText('111,080円')

  await page.click('#invoice-form button[type="submit"]')

  await expect(page.locator('#panel-history')).toHaveClass(/active/)
  await expect(page.locator('#invoices-body')).toContainText('株式会社テスト取引先')
  await expect(page.locator('#invoices-body')).toContainText('111,080円')
  await expect(page.locator('#invoices-body')).toContainText('INV-2026-0001')
})

test('請求書番号は保存するたびに連番で増える', async ({ page }) => {
  await page.goto('/')
  for (const client of ['取引先A', '取引先B']) {
    await page.click('button[data-tab="invoice"]')
    await page.fill('#invoiceClientName', client)
    await page.fill('#issueDate', '2026-09-27')
    await page.fill('[data-field="name"][data-index="0"]', '商品')
    await page.fill('[data-field="quantity"][data-index="0"]', '1')
    await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
    await page.click('#invoice-form button[type="submit"]')
  }
  const rows = page.locator('#invoices-body tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('INV-2026-0002')
  await expect(rows.nth(1)).toContainText('INV-2026-0001')
})

test('CSVエクスポートがBOM付きUTF-8で日本語ヘッダーを含む', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', '株式会社サンプル')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="name"][data-index="0"]', '商品')
  await page.fill('[data-field="quantity"][data-index="0"]', '1')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '1000')
  await page.click('#invoice-form button[type="submit"]')

  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^invoice-history-\d{8}\.csv$/)

  const csvPath = await download.path()
  const fs = await import('node:fs')
  const buf = fs.readFileSync(csvPath!)
  expect(buf[0]).toBe(0xef)
  expect(buf[1]).toBe(0xbb)
  expect(buf[2]).toBe(0xbf)
  expect(buf.toString('utf-8')).toContain('請求書番号')
})

test('全データのJSONバックアップとインポートを往復できる', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="profile"]')
  await page.fill('#businessName', '往復テスト商店')
  await page.fill('#registrationNumber', 'T1234567890123')
  await page.click('#profile-form button[type="submit"]')
  await expect(page.locator('#profile-errors')).toHaveText('保存しました。')

  await page.click('button[data-tab="history"]')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await downloadPromise
  const jsonPath = await download.path()
  expect(download.suggestedFilename()).toMatch(/^invoice-generator-backup-\d{8}\.json$/)

  await page.click('button[data-tab="profile"]')
  await page.fill('#businessName', '書き換え後')
  await page.click('#profile-form button[type="submit"]')
  await expect(page.locator('#profile-errors')).toHaveText('保存しました。')

  await page.click('button[data-tab="history"]')
  const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#import-json')])
  await fileChooser.setFiles(jsonPath!)
  await expect(page.locator('#history-errors')).toHaveText('インポートが完了しました。')

  await page.click('button[data-tab="profile"]')
  await expect(page.locator('#businessName')).toHaveValue('往復テスト商店')
})

test('印刷ボタンで印刷用領域に日本語の請求書内容が正しく展開される', async ({ page }) => {
  await page.goto('/')
  await page.click('button[data-tab="invoice"]')
  await page.fill('#invoiceClientName', '株式会社印刷確認')
  await page.fill('#issueDate', '2026-09-27')
  await page.fill('[data-field="name"][data-index="0"]', '検品作業費')
  await page.fill('[data-field="quantity"][data-index="0"]', '2')
  await page.fill('[data-field="unitPriceYen"][data-index="0"]', '5000')
  await page.click('#invoice-form button[type="submit"]')

  await page.evaluate(() => {
    window.print = () => {}
  })
  await page.click('[data-print]')

  await expect(page.locator('#print-area')).toContainText('株式会社印刷確認 様')
  await expect(page.locator('#print-area')).toContainText('検品作業費')
  await expect(page.locator('#print-area')).toContainText('11,000円')
})

test('スマホ幅(375px)で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalScroll).toBe(false)
})
