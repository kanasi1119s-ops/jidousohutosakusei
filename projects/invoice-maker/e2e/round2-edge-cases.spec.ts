import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

const REPLACEMENT_CHAR = String.fromCharCode(0xfffd)

async function fillRow(page: Page, row: number, f: Record<string, string>) {
  const tr = page.locator('#items-body tr').nth(row)
  for (const [k, v] of Object.entries(f)) await tr.locator(`[data-field="${k}"]`).fill(v)
}

test('横スクロールが発生しない（スマホ幅・PC幅）', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }))
    expect(m.sw, `width=${width}`).toBeLessThanOrEqual(m.cw)
  }
})

test('全角数字・カンマ・円付きの入力を受け付ける', async ({ page }) => {
  await page.goto('/')
  await fillRow(page, 0, { name: '全角テスト', quantity: '１．５', unitPriceYen: '１０，０００円' })
  await expect(page.locator('#grand-total')).toHaveText('16,500円')
  await expect(page.locator('#messages')).toHaveText('')
})

test('不正な数量・単価はエラー表示し、直前の有効値のまま計算され、フォーカスを外すと値が戻る', async ({ page }) => {
  await page.goto('/')
  await fillRow(page, 0, { name: 'x', quantity: '1', unitPriceYen: '1000' })
  const price = page.locator('[data-field="unitPriceYen"]').first()
  for (const bad of ['abc', '1.5', '9999999999', '1e5']) {
    await price.fill(bad)
    await expect(page.locator('#messages')).toContainText('単価')
    await expect(page.locator('#grand-total')).toHaveText('1,100円')
  }
  const qty = page.locator('[data-field="quantity"]').first()
  for (const bad of ['-1', '99999', 'あ']) {
    await qty.fill(bad)
    await expect(page.locator('#messages')).toContainText('数量')
    await expect(page.locator('#grand-total')).toHaveText('1,100円')
  }
  await qty.blur()
  await expect(qty).toHaveValue('1')
})

test('最大値の入力でもクラッシュせず整数で計算される', async ({ page }) => {
  await page.goto('/')
  await fillRow(page, 0, { name: '最大', quantity: '9999.999', unitPriceYen: '999999999' })
  await expect(page.locator('#grand-total')).toContainText('円')
  await expect(page.locator('#grand-total')).not.toContainText('NaN')
  await expect(page.locator('#grand-total')).not.toContainText('e+')
})

test('明細は最低1行・最大100行', async ({ page }) => {
  await page.goto('/')
  await page.locator('button[data-action="remove"]').click()
  await expect(page.locator('#messages')).toContainText('最低1行')
  await expect(page.locator('#items-body tr')).toHaveCount(1)
  for (let i = 0; i < 110; i++) await page.click('#add-item')
  await expect(page.locator('#items-body tr')).toHaveCount(100)
  await expect(page.locator('#messages')).toContainText('最大100行')
})

test('保存の連打で重複せず1件のまま更新される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '連打テスト')
  await page.dblclick('#save-invoice')
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list li[data-id]')).toHaveCount(1)
})

test('複製すると請求書番号が1つ進み、保存すると2件になる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#invoiceNumber', 'A-009')
  await page.click('#save-invoice')
  await page.locator('button[data-action="copy"]').click()
  await expect(page.locator('#invoiceNumber')).toHaveValue('A-010')
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list li[data-id]')).toHaveCount(2)
})

test('HTMLを含む入力はスクリプトとして実行されず、文字として表示される', async ({ page }) => {
  await page.goto('/')
  const payload = '<img src=x onerror="window.__xss=1">'
  await page.fill('#clientName', payload)
  await page.fill('#notes', payload)
  await fillRow(page, 0, { name: payload })
  await page.click('#save-invoice')
  await page.reload()
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('#sheet img')).toHaveCount(0)
  await expect(page.locator('#sheet')).toContainText(payload)
})

test('不正なバックアップファイルはエラー表示され、既存データは壊れない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '既存データ')
  await page.click('#save-invoice')
  for (const body of ['これはJSONではありません', '{"app":"other","invoices":[]}', '{"app":"invoice-maker","invoices":[{"items":[]}]}']) {
    await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(body, 'utf8') })
    await expect(page.locator('#messages.error')).toBeVisible()
  }
  await expect(page.locator('#saved-list')).toContainText('既存データ')
})

test('半角カナ・異体字・絵文字・サロゲートペアが保存・表示・CSVで化けない', async ({ page }) => {
  await page.goto('/')
  const text = 'ﾊﾝｶｸｶﾅ 𠮷野家 髙橋 ① ㈱ 😀'
  await page.fill('#clientName', text)
  await fillRow(page, 0, { name: text, unitPriceYen: '1000' })
  await page.click('#save-invoice')
  await page.reload()
  await expect(page.locator('#sheet')).toContainText(text)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  const bytes = fs.readFileSync((await dl.path())!)
  expect(bytes.toString('utf8')).toContain(text)
  expect(bytes.toString('utf8')).not.toContain(REPLACEMENT_CHAR)
})

test('画面全体に文字化け（置換文字）がない', async ({ page }) => {
  await page.goto('/')
  const text = await page.evaluate(() => document.body.innerText)
  expect(text).not.toContain(REPLACEMENT_CHAR)
  expect(text).not.toMatch(/ã\u0081|ã\u0082|æ\u0096/)
})

test('印刷時は請求書プレビューだけが表示される', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#sheet')).toBeVisible()
  await expect(page.locator('#invoice-form')).toBeHidden()
  await expect(page.locator('#checks')).toBeHidden()
})

test('CSVの式インジェクションが無効化される', async ({ page }) => {
  await page.goto('/')
  await fillRow(page, 0, { name: '=1+1', unitPriceYen: '100' })
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')])
  const text = fs.readFileSync((await dl.path())!).toString('utf8')
  expect(text).toContain("'=1+1")
})

test('オフラインでも再読み込みして計算・保存データの復元ができる', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.fill('#clientName', 'オフライン商店')
  await page.click('#save-invoice')
  // Service Worker が制御するページになるよう1回リロード
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await expect(page.locator('#saved-list')).toContainText('オフライン商店')
  await fillRow(page, 0, { name: 'offline', quantity: '2', unitPriceYen: '500' })
  await expect(page.locator('#grand-total')).toHaveText('1,100円')
  await context.setOffline(false)
})

test('操作してもコンソールエラー（CSP違反を含む）が出ない', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await fillRow(page, 0, { name: 'x', unitPriceYen: '1000' })
  await page.check('#withholding')
  await page.click('#add-item')
  await page.click('#save-invoice')
  await page.emulateMedia({ media: 'print' })
  expect(errors).toEqual([])
})
