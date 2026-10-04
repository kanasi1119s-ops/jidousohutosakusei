import { expect, test } from '@playwright/test'
import fs from 'node:fs'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('全角数字・カンマ付きの金額を受け付ける', async ({ page }) => {
  await page.getByLabel('数量 1').fill('１')
  await page.getByLabel('単価 1').fill('１２，０００')
  await expect(page.locator('#grand-total')).toHaveText('¥13,200')
})

test('不正な金額は赤枠表示され0円として扱われる', async ({ page }) => {
  await page.getByLabel('単価 1').fill('abc')
  await expect(page.getByLabel('単価 1')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#grand-total')).toHaveText('¥0')
  await page.getByLabel('単価 1').fill('999999999999')
  await expect(page.getByLabel('単価 1')).toHaveAttribute('aria-invalid', 'true')
})

test('HTMLを入力してもタグとして解釈されない（XSS対策）', async ({ page }) => {
  await page.getByLabel('請求先名').fill('<img src=x onerror="window.__xss=1">')
  await page.getByLabel('品目 1').fill('<b>太字</b>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  await expect(page.locator('#preview b')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('#preview')).toContainText('<b>太字</b>')
})

test('明細をすべて削除しても1行残り、上限50行で追加が止まる', async ({ page }) => {
  await page.getByRole('button', { name: '明細 1 を削除' }).click()
  await expect(page.getByLabel('品目 1')).toBeVisible()
  for (let i = 0; i < 55; i++) await page.locator('#add-item').click()
  await expect(page.locator('.item-row')).toHaveCount(50)
  await expect(page.locator('#message')).toContainText('最大50行')
})

test('保存→読み込み→削除ができる', async ({ page }) => {
  await page.getByLabel('請求書番号').fill('A-1')
  await page.getByLabel('請求先名').fill('保存テスト商事')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('#saved-list')).toContainText('保存テスト商事')
  await page.getByLabel('請求先名').fill('変更後')
  await page.getByRole('button', { name: '読み込み' }).click()
  await expect(page.getByLabel('請求先名')).toHaveValue('保存テスト商事')
  await page.getByRole('button', { name: /を削除$/ }).last().click()
  await expect(page.locator('#saved-list')).toContainText('まだありません')
})

test('JSONバックアップの書き出し→読み込みで往復できる（日本語保持）', async ({ page }) => {
  await page.getByLabel('請求先名').fill('往復テスト株式会社')
  await page.getByLabel('備考').fill('備考の一行目\n二行目')
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-json').click()])
  expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9._-]+\.json$/)
  const file = await download.path()
  expect(fs.readFileSync(file, 'utf8')).toContain('往復テスト株式会社')

  await page.getByLabel('請求先名').fill('')
  await page.locator('#import-file').setInputFiles(file)
  await expect(page.getByLabel('請求先名')).toHaveValue('往復テスト株式会社')
  await expect(page.getByLabel('備考')).toHaveValue('備考の一行目\n二行目')
})

test('壊れたバックアップは拒否されエラー表示される', async ({ page }) => {
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{oops') })
  await expect(page.locator('#message')).toContainText('読み取れませんでした')
})

test('印刷表示ではフォームが隠れ、請求書だけが残る', async ({ page }) => {
  await page.getByLabel('請求先名').fill('印刷テスト')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#form')).toBeHidden()
  await expect(page.locator('.toolbar')).toBeHidden()
  await expect(page.locator('#preview')).toBeVisible()
  await expect(page.locator('#preview')).toContainText('印刷テスト')
})

test('横スクロールが発生しない（スマホ幅・PC幅）', async ({ page }) => {
  await page.getByLabel('請求先名').fill('とても長い請求先名とても長い請求先名とても長い請求先名とても長い請求先名')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('ネットワークを切ってもリロードして動作する（オフライン）', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload() // SW制御下に入れる
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '請求書ジェネレーター' })).toBeVisible()
  await page.getByLabel('単価 1').fill('1000')
  await expect(page.locator('#grand-total')).toHaveText('¥1,100')
  await context.setOffline(false)
})

test('プレビューの明細表の金額列が画面幅内に収まる（Round2 で発見した表崩れの回帰）', async ({ page }) => {
  await page.getByLabel('品目 1').fill('Webサイト制作費')
  await page.getByLabel('単価 1').fill('100000')
  const vw = await page.evaluate(() => document.documentElement.clientWidth)
  const box = await page.locator('#preview .doc-table th', { hasText: '金額（税抜）' }).boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw)
  // 品目名が1文字ずつ縦に折り返されない
  const cell = await page.locator('#preview .doc-table td', { hasText: 'Webサイト制作費' }).first().boundingBox()
  expect(cell!.height).toBeLessThan(80)
})
