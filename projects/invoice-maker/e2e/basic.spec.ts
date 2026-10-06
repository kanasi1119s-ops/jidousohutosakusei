import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.getByLabel('氏名または名称').fill('山田デザイン事務所')
  await page.getByLabel(/登録番号/).first().fill('T1234567890123')
  await page.getByLabel('請求先名').fill('株式会社サンプル')
  await page.getByLabel('品目 1').fill('ロゴデザイン一式')
  await page.getByLabel('単価 1').fill('100,000')
}

test.describe('基本フロー', () => {
  test('日本語の見出し・ボタンが正しく表示される', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('適格請求書メーカー')
    await expect(page.getByRole('heading', { name: '請求書', level: 2 })).toBeVisible()
    for (const name of ['この請求書を保存', 'PDF保存・印刷', 'CSV出力', '＋ 明細を追加']) {
      await expect(page.getByRole('button', { name })).toBeVisible()
    }
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    const charset = await page.evaluate(() => document.characterSet)
    expect(charset).toBe('UTF-8')
  })

  test('明細を入力すると税額と請求額が計算される', async ({ page }) => {
    await page.goto('/')
    await fillBasic(page)
    await expect(page.getByTestId('net-10')).toHaveText('¥100,000')
    await expect(page.getByTestId('tax-10')).toHaveText('¥10,000')
    await expect(page.getByTestId('payable')).toHaveText('¥110,000')
    await expect(page.locator('#preview')).toContainText('登録番号: T1234567890123')
    await expect(page.locator('#preview')).toContainText('株式会社サンプル 御中')
  })

  test('軽減税率と源泉徴収が反映される', async ({ page }) => {
    await page.goto('/')
    await fillBasic(page)
    await page.getByRole('button', { name: '＋ 明細を追加' }).click()
    await page.getByLabel('品目 2').fill('お菓子')
    await page.getByLabel('単価 2').fill('1000')
    await page.getByLabel('税率 2').selectOption('8')
    await page.getByLabel(/源泉徴収/).check()
    await expect(page.getByTestId('tax-8')).toHaveText('¥80')
    await expect(page.getByTestId('withholding')).toHaveText('-¥10,312')
    // 税抜合計 101,000円 × 10.21% = 10,312.1 → 10,312（1円未満切り捨て）
  })

  test('登録番号の形式チェックが表示される', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/登録番号/).first().fill('T123')
    await expect(page.locator('#reg-hint')).toContainText('形式が正しくありません')
    await page.getByLabel(/登録番号/).first().fill('T1234567890123')
    await expect(page.locator('#reg-hint')).toContainText('形式OK')
  })

  test('CSV出力はBOM付きUTF-8で、ファイル名は英数字のみ', async ({ page }) => {
    await page.goto('/')
    await fillBasic(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV出力' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.csv$/)
    const path = await download.path()
    const buf = fs.readFileSync(path)
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
    const text = buf.toString('utf-8')
    expect(text).toContain('株式会社サンプル')
    expect(text).toContain('ロゴデザイン一式')
    expect(text).not.toContain('�')
  })

  test('保存した請求書と発行者情報は再読み込み後も復元される', async ({ page }) => {
    await page.goto('/')
    await fillBasic(page)
    await page.getByRole('button', { name: 'この請求書を保存' }).click()
    await expect(page.getByTestId('saved-item')).toHaveCount(1)
    await page.reload()
    await expect(page.getByLabel('氏名または名称')).toHaveValue('山田デザイン事務所')
    await expect(page.getByTestId('saved-item')).toHaveCount(1)
    await page.getByRole('button', { name: '開く' }).click()
    await expect(page.getByLabel('請求先名')).toHaveValue('株式会社サンプル')
    await expect(page.getByTestId('payable')).toHaveText('¥110,000')
  })

  test('JSONバックアップのエクスポート→インポートが往復できる', async ({ page }) => {
    await page.goto('/')
    await fillBasic(page)
    await page.getByRole('button', { name: 'この請求書を保存' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /全データをバックアップ/ }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.json$/)
    const file = await download.path()
    expect(fs.readFileSync(file).toString('utf-8')).toContain('山田デザイン事務所')

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByTestId('saved-item')).toHaveCount(0)
    await page.locator('#import-json').setInputFiles(file)
    await expect(page.locator('#message')).toContainText('読み込みました')
    await expect(page.getByTestId('saved-item')).toHaveCount(1)
    await expect(page.getByLabel('氏名または名称')).toHaveValue('山田デザイン事務所')
  })

  test('外部通信が発生しない（同一オリジンのみ）', async ({ page, baseURL }) => {
    const external: string[] = []
    page.on('request', (r) => {
      const u = r.url()
      if (!u.startsWith(baseURL!) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
    })
    await page.goto('/')
    await fillBasic(page)
    await page.waitForLoadState('networkidle')
    expect(external).toEqual([])
  })

  test('印刷時は入力フォームが非表示になり請求書のみ表示される', async ({ page }) => {
    await page.goto('/')
    await fillBasic(page)
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('#form-panel, section.panel')).toBeHidden()
    await expect(page.locator('#preview')).toBeVisible()
  })
})
