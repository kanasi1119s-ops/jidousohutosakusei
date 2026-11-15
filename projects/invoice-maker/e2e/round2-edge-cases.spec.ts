import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('空欄のまま保存するとエラーが表示され、保存されない', async ({ page }) => {
  await page.goto('/')
  await page.click('#save-invoice')
  await expect(page.locator('#errors')).toContainText('宛名')
  await expect(page.locator('#errors')).toContainText('品名')
  await page.click('#tabbtn-list')
  await expect(page.locator('#list-empty')).toBeVisible()
})

test('不正な数量・単価はエラーになりクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', 'X')
  await page.fill('#item-name-0', '品')
  await page.fill('#item-qty-0', 'abc')
  await page.fill('#item-price-0', '10.5')
  await page.click('#save-invoice')
  await expect(page.locator('#errors')).toContainText('数量')
  await expect(page.locator('#errors')).toContainText('単価')
  await expect(page.locator('#sum-total')).toHaveCount(0)
})

test('極端に大きい金額は拒否される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#item-name-0', '品')
  await page.fill('#item-qty-0', '9999')
  await page.fill('#item-price-0', '99999999')
  await page.click('#save-invoice')
  await expect(page.locator('#errors')).toContainText('税抜合計')
})

test('HTMLを含む入力が実行・解釈されない（XSS対策）', async ({ page }) => {
  await page.goto('/')
  let dialogSeen = false
  page.on('dialog', () => {
    dialogSeen = true
  })
  await page.fill('#clientName', '<img src=x onerror=alert(1)>')
  await page.fill('#item-name-0', '<script>alert(2)</script>')
  await page.fill('#note', '<b>太字</b>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  await expect(page.locator('#preview script')).toHaveCount(0)
  await expect(page.locator('#preview')).toContainText('<img src=x onerror=alert(1)>')
  expect(dialogSeen).toBe(false)
})

test('登録番号の形式エラーは設定保存時に拒否される', async ({ page }) => {
  await page.goto('/')
  await page.click('#tabbtn-settings')
  await page.fill('#registrationNumber', 'T123')
  await page.click('#save-settings')
  await expect(page.locator('#settings-msg')).toContainText('T＋数字13桁')
})

test('JSONバックアップの書き出し→全削除→インポートで往復できる（日本語保持）', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.fill('#clientName', '株式会社往復テスト')
  await page.fill('#item-name-0', '設計・実装')
  await page.fill('#item-price-0', '30000')
  await page.click('#save-invoice')
  await page.click('#tabbtn-data')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-json')])
  expect(download.suggestedFilename()).toMatch(/^invoice-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)
  expect(fs.readFileSync(file, 'utf8')).toContain('株式会社往復テスト')

  page.once('dialog', (d) => d.accept())
  await page.click('#clear-data')
  await page.click('#tabbtn-list')
  await expect(page.locator('#list-empty')).toBeVisible()

  await page.click('#tabbtn-data')
  await page.setInputFiles('#import-json', { name: 'backup.json', mimeType: 'application/json', buffer: fs.readFileSync(file) })
  await expect(page.locator('#data-msg')).toContainText('インポートしました')
  await page.click('#tabbtn-list')
  await expect(page.locator('#list-body')).toContainText('株式会社往復テスト御中')
})

test('不正なファイルのインポートはエラー表示になる', async ({ page }) => {
  await page.goto('/')
  await page.click('#tabbtn-data')
  await page.setInputFiles('#import-json', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}', 'utf8') })
  await expect(page.locator('#data-msg')).toContainText('バックアップファイルではありません')
})

test('PC幅・スマホ幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.fill('#item-name-0', '横幅確認のためのとても長い品名とても長い品名とても長い品名')
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(over, `width=${width}`).toBe(false)
  }
})

test('オフライン（ネットワーク切断）でも請求書を作成できる', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー')
  await page.fill('#clientName', 'オフライン商事')
  await page.fill('#item-name-0', '作業')
  await page.fill('#item-price-0', '1000')
  await expect(page.locator('#sum-total')).toHaveText('¥1,100')
  await page.click('#save-invoice')
  await expect(page.locator('#status')).toContainText('保存しました')
  await context.setOffline(false)
})

test('外部ドメインへの通信が発生しない', async ({ page, baseURL }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(baseURL!) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
  })
  await page.goto('/')
  await page.fill('#clientName', '通信確認')
  await page.click('#save-invoice')
  expect(external).toEqual([])
})
