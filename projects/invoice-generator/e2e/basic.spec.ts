import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

async function fillBasic(page: Page) {
  await page.fill('#issuer-name', '株式会社サンプル')
  await page.fill('#issuer-reg', 'T1234567890123')
  await page.fill('#client-name', '取引先株式会社')
  await page.fill('.item-desc', 'ウェブサイト制作')
  await page.fill('.item-qty', '2')
  await page.fill('.item-price', '33')
}

test('日本語の見出しとフォームが正しく表示される', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('請求書ジェネレーター')
  await expect(page.getByText('登録不要')).toBeVisible()
  await expect(page.locator('#pv-title')).toHaveText('請求書（適格請求書）')
  await expect(page.locator('#save-invoice')).toHaveText('保存')
})

test('入力すると税率ごとに1回だけ端数処理した合計がプレビューに出る', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#add-item')
  await page.locator('.item-desc').nth(1).fill('食料品')
  await page.locator('.item-price').nth(1).fill('１，０００') // 全角・カンマ
  await page.locator('.item-rate').nth(1).selectOption('8')
  await expect(page.locator('#pv-groups tr')).toHaveCount(2)
  // 10%: 66円→税6円、8%: 1000円→税80円。合計 66+6+1000+80=1152
  await expect(page.locator('#pv-total')).toHaveText('¥1,152')
  await expect(page.locator('#pv-issuer-reg')).toContainText('T1234567890123')
  await expect(page.locator('#errors')).toBeEmpty()
})

test('登録番号が不正だとエラー表示され保存できない', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.fill('#issuer-reg', 'T12')
  await expect(page.locator('#errors')).toContainText('登録番号')
  await page.click('#save-invoice')
  await expect(page.locator('#status')).toContainText('保存できません')
  await expect(page.locator('#saved-list li.empty')).toBeVisible()
})

test('保存→再読み込み後も復元され、開く・削除ができる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  await expect(page.locator('#saved-list li')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('#saved-list')).toContainText('取引先株式会社')
  await expect(page.locator('#issuer-name')).toHaveValue('株式会社サンプル') // 発行者は既定値として復元
  await page.click('.saved-load')
  await expect(page.locator('#client-name')).toHaveValue('取引先株式会社')
  page.once('dialog', (d) => d.accept())
  await page.click('.saved-delete')
  await expect(page.locator('#saved-list li.empty')).toBeVisible()
})

test('CSVはBOM付きUTF-8・英数字ファイル名で日本語を含む', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  const dl = page.waitForEvent('download')
  await page.click('#export-csv')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/)
  const buf = fs.readFileSync((await download.path())!)
  expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf])
  expect(buf.toString('utf-8')).toContain('ウェブサイト制作')
})

test('バックアップJSONを書き出して削除後に読み込むと復元できる', async ({ page }) => {
  await page.goto('/')
  await fillBasic(page)
  await page.click('#save-invoice')
  const dl = page.waitForEvent('download')
  await page.click('#export-json')
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^invoice-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await download.path())!
  page.once('dialog', (d) => d.accept())
  await page.click('.saved-delete')
  await expect(page.locator('#saved-list li.empty')).toBeVisible()
  await page.setInputFiles('#import-file', path)
  await expect(page.locator('#saved-list')).toContainText('取引先株式会社')
})
