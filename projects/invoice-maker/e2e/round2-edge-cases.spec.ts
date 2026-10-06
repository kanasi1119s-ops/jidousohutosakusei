import { expect, test } from '@playwright/test'
import fs from 'node:fs'

const jsonFile = (text: string) => ({
  name: 'import.json',
  mimeType: 'application/json',
  buffer: Buffer.from(text, 'utf-8'),
})

test('オフライン（ネットワーク切断）でも作成・計算できる', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('適格請求書メーカー')
  await page.getByLabel('単価 1').fill('2000')
  await expect(page.getByTestId('payable')).toHaveText('¥2,200')
  await context.setOffline(false)
})

test('全角数字・カンマ・円記号の入力が半角として計算される', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('数量 1').fill('２')
  await page.getByLabel('単価 1').fill('￥１，５００')
  await expect(page.getByTestId('net-10')).toHaveText('¥3,000')
})

test('不正入力（文字・空・巨大数）でもクラッシュせず0または上限に丸められる', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('単価 1').fill('あいうえお')
  await expect(page.getByTestId('payable')).toHaveText('¥0')
  await page.getByLabel('単価 1').fill('')
  await expect(page.getByTestId('payable')).toHaveText('¥0')
  await page.getByLabel('単価 1').fill('9'.repeat(30))
  await page.getByLabel('数量 1').fill('9'.repeat(30))
  await expect(page.getByTestId('payable')).toBeVisible()
  const text = await page.getByTestId('payable').textContent()
  expect(text).not.toMatch(/NaN|Infinity|e\+/)
})

test('品目名・請求先に入力したHTMLタグは実行されず文字として表示される（XSS対策）', async ({ page }) => {
  let dialogOpened = false
  page.on('dialog', async (d) => {
    dialogOpened = true
    await d.dismiss()
  })
  await page.goto('/')
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>'
  await page.getByLabel('請求先名').fill(payload)
  await page.getByLabel('品目 1').fill(payload)
  await page.getByLabel('備考').fill(payload)
  await expect(page.locator('#preview')).toContainText('<img src=x')
  expect(await page.locator('#preview img').count()).toBe(0)
  expect(dialogOpened).toBe(false)
})

test('明細を全て削除しても1行は残り、追加・削除の連打で壊れない', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '明細 1 を削除' }).click()
  await expect(page.getByTestId('item-row')).toHaveCount(1)
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '＋ 明細を追加' }).click()
  await expect(page.getByTestId('item-row')).toHaveCount(6)
  await page.getByRole('button', { name: '明細 3 を削除' }).click()
  await expect(page.getByTestId('item-row')).toHaveCount(5)
})

test('保存ボタンの二重クリックで同じ請求書が重複しない', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('請求先名').fill('重複テスト')
  const btn = page.getByRole('button', { name: 'この請求書を保存' })
  await btn.dblclick()
  await expect(page.getByTestId('saved-item')).toHaveCount(1)
})

test('不正なJSONのインポートはエラー表示のみで既存データを壊さない', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('氏名または名称').fill('残るべきデータ')
  await page.locator('#import-json').setInputFiles(jsonFile('{ this is not json'))
  await expect(page.locator('#message')).toContainText('JSONとして読み込めません')
  await expect(page.getByLabel('氏名または名称')).toHaveValue('残るべきデータ')
  await page.locator('#import-json').setInputFiles(jsonFile(JSON.stringify({ version: 99 })))
  await expect(page.locator('#message')).toContainText('対応していない')
})

test('BOM付きJSONのインポートができる（Windowsメモ帳等で保存し直した場合）', async ({ page }) => {
  await page.goto('/')
  const body = '\uFEFF' + JSON.stringify({ version: 1, issuer: { name: '日本語名' }, invoices: [] })
  await page.locator('#import-json').setInputFiles(jsonFile(body))
  await expect(page.getByLabel('氏名または名称')).toHaveValue('日本語名')
})

test('スマホ幅・PC幅で横スクロールが発生しない（長い入力でも）', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('品目 1').fill('とても長い品目名'.repeat(20))
  await page.getByLabel('単価 1').fill('123456789')
  await page.getByLabel('請求先名').fill('A'.repeat(200))
  const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHScroll).toBe(false)
})

test('CSVの先頭が = の品目名は数式として解釈されないよう無害化される', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('品目 1').fill('=HYPERLINK("http://example.com")')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV出力' }).click(),
  ])
  const text = fs.readFileSync(await download.path(), 'utf-8')
  expect(text).toContain("'=HYPERLINK")
})

test('途中の請求書を削除しても、新規作成の請求書番号が既存と重複しない', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
  const numberInput = page.getByLabel('請求書番号')
  for (let i = 0; i < 3; i++) {
    await page.getByLabel('請求先名').fill(`顧客${i}`)
    await page.getByRole('button', { name: 'この請求書を保存' }).click()
    await page.getByRole('button', { name: '新しい請求書' }).click()
  }
  await expect(page.getByTestId('saved-item')).toHaveCount(3)
  await page.getByTestId('saved-item').first().getByRole('button', { name: '削除' }).click()
  await expect(page.getByTestId('saved-item')).toHaveCount(2)
  await page.getByRole('button', { name: '新しい請求書' }).click()
  const labels = await page.getByTestId('saved-item').locator('.label').allTextContents()
  const existing = labels.map((l) => l.split(' / ')[0])
  const current = await numberInput.inputValue()
  expect(existing).not.toContain(current)
})

test('未保存の変更がある状態で「新しい請求書」を押すと確認され、キャンセルで内容が残る', async ({ page }) => {
  let message = ''
  page.on('dialog', async (d) => {
    message = d.message()
    await d.dismiss()
  })
  await page.goto('/')
  await page.getByLabel('請求先名').fill('入力途中')
  await page.getByRole('button', { name: '新しい請求書' }).click()
  expect(message).toContain('保存していない変更')
  await expect(page.getByLabel('請求先名')).toHaveValue('入力途中')
})

test('変更が無い状態では確認なしで新しい請求書を作成できる', async ({ page }) => {
  let dialogs = 0
  page.on('dialog', async (d) => {
    dialogs++
    await d.dismiss()
  })
  await page.goto('/')
  await page.getByRole('button', { name: '新しい請求書' }).click()
  expect(dialogs).toBe(0)
})
