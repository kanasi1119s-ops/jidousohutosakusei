import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 日本語を含むテスト名のパスだとサンドボックス環境で setInputFiles が失敗するため、ASCIIのみの一時ディレクトリを使う
const tmp = (name: string) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'im-')), name)

test('不正なJSONを読み込んでも壊れずエラー表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '残るべき名前')
  const bad = tmp('bad.json')
  fs.writeFileSync(bad, '{"items":[{"taxRate":5}]}', 'utf-8')
  await page.setInputFiles('#import-file', bad)
  await expect(page.locator('#import-msg')).toContainText('読み込めませんでした')
  await expect(page.locator('#clientName')).toHaveValue('残るべき名前')
})

test('BOM付きJSONも読み込める', async ({ page }) => {
  await page.goto('/')
  const f = tmp('bom.json')
  fs.writeFileSync(f, '﻿{"clientName":"BOM株式会社"}', 'utf-8')
  await page.setInputFiles('#import-file', f)
  await expect(page.locator('#clientName')).toHaveValue('BOM株式会社')
})

test('HTMLタグを入力してもスクリプトとして実行されない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#clientName', '<img src=x onerror="window.__xss=1">')
  await expect(page.locator('#pv-client img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('数量に不正文字を入れると入力欄が無効表示になり合計は壊れない', async ({ page }) => {
  await page.goto('/')
  await page.locator('.item-price').first().fill('1000')
  await page.locator('.item-qty').first().fill('abc')
  await expect(page.locator('.item-qty').first()).toHaveClass(/invalid/)
  await expect(page.locator('#pv-total')).toContainText('1,100円')
})

test('明細を全て削除しても空行が1行残る', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /明細 1 を削除/ }).click()
  await expect(page.locator('#items-body tr')).toHaveCount(1)
})

test('巨大な金額でもクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.locator('.item-price').first().fill('999999999999')
  await expect(page.locator('#pv-total')).toContainText('円')
})

test('オフラインでもリロードして使える', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('請求書メーカー（インボイス対応）')
  await page.fill('#clientName', 'オフライン商事')
  await expect(page.locator('#pv-client')).toHaveText('オフライン商事 御中')
})

test('スマホ幅で横スクロールが発生しない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})
