import { expect, test } from '@playwright/test'
import fs from 'node:fs'

test('日本語の見出し・ボタンが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'インボイス請求書ジェネレーター' })).toBeVisible()
  await expect(page.getByRole('button', { name: '明細を追加' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSVをダウンロード' })).toBeVisible()
})

test('明細を入力すると税率ごとの小計・消費税・合計が出る（全角数字OK）', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('氏名または名称').fill('テスト商店')
  await page.getByLabel('登録番号（T+13桁）').fill('Ｔ１２３４５６７８９０１２３')
  await page.getByLabel('請求先名称').fill('株式会社サンプル')
  await page.getByLabel('品名 1').fill('デザイン費')
  await page.getByLabel('数量 1').fill('２')
  await page.getByLabel('単価 1').fill('１０，０００')
  await page.getByRole('button', { name: '明細を追加' }).click()
  await page.getByLabel('品名 2').fill('飲料')
  await page.getByLabel('単価 2').fill('99')
  await page.getByLabel('税率 2').selectOption('8')
  const sheet = page.locator('#preview')
  await expect(sheet).toContainText('株式会社サンプル 御中')
  await expect(sheet).toContainText('登録番号: T1234567890123')
  await expect(sheet).toContainText('¥2,000') // 10%消費税
  await expect(sheet).toContainText('¥7') // 8%消費税(切り捨て)
  await expect(sheet).toContainText('ご請求金額（税込）: ¥22,106')
  await expect(sheet).toContainText('※ は軽減税率')
  await expect(page.locator('#reg-warn')).toHaveCount(0)
})

test('登録番号の形式が不正なら警告', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('登録番号（T+13桁）').fill('T123')
  await expect(page.locator('#reg-warn')).toBeVisible()
})

test('CSVはBOM付きUTF-8でファイル名は英数字のみ', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('品名 1').fill('日本語の品名')
  await page.getByLabel('単価 1').fill('1000')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSVをダウンロード' }).click()])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.csv$/)
  const buf = fs.readFileSync(await dl.path())
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('日本語の品名')
})

test('リロード後に入力が復元され、JSONの書き出し→消去→読み込みで往復できる', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('請求先名称').fill('復元テスト会社')
  await page.getByLabel('品名 1').fill('保守')
  await page.getByLabel('単価 1').fill('5000')
  await page.reload()
  await expect(page.getByLabel('請求先名称')).toHaveValue('復元テスト会社')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'バックアップ(JSON)を保存' }).click()])
  expect(dl.suggestedFilename()).toMatch(/^[A-Za-z0-9_.-]+\.json$/)
  const path = await dl.path()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '入力をすべて消去' }).click()
  await expect(page.getByLabel('請求先名称')).toHaveValue('')
  await page.locator('#import-json').setInputFiles(path)
  await expect(page.getByLabel('請求先名称')).toHaveValue('復元テスト会社')
  await expect(page.locator('#preview')).toContainText('¥5,500')
})

test('不正なJSONを読み込んでもクラッシュせずメッセージが出る', async ({ page }) => {
  await page.goto('/')
  await page.locator('#import-json').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{oops') })
  await expect(page.locator('#messages')).toContainText('読み込めませんでした')
  await expect(page.getByRole('heading', { name: 'インボイス請求書ジェネレーター' })).toBeVisible()
})

test('XSS文字列はテキストとして表示される', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('請求先名称').fill('<img src=x onerror=window.__x=1>')
  await expect(page.locator('#preview')).toContainText('<img src=x onerror=window.__x=1>')
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
})

test('横スクロールが発生しない（スマホ幅/PC幅）', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('オフラインでも再読み込みして使える', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // SWが制御下に入る
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'インボイス請求書ジェネレーター' })).toBeVisible()
  await page.getByLabel('請求先名称').fill('オフライン')
  await expect(page.locator('#preview')).toContainText('オフライン 御中')
  await context.setOffline(false)
})
