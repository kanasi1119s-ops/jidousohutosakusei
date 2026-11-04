import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync, spawn, type ChildProcess } from 'node:child_process'

test('不正なJSONを読み込むとエラーを表示し、既存データを壊さない', async ({ page }) => {
  await page.goto('/')
  await page.locator('#client-name').fill('消えてはいけない')
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')), 'bad.json')
  fs.writeFileSync(tmp, '{"hello": "world"}', 'utf-8')
  await page.locator('#import-json').setInputFiles(tmp)
  await expect(page.getByRole('status')).toContainText('形式が不正')
  await expect(page.locator('#client-name')).toHaveValue('消えてはいけない')
})

test('数量・単価に不正値を入れても計算が壊れない（直前の有効値を維持）', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('単価 1').fill('5000')
  await page.getByLabel('単価 1').fill('abc')
  await expect(page.getByLabel('単価 1')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#preview-total')).toHaveText('¥5,500')
  await page.getByLabel('単価 1').blur()
  await expect(page.getByLabel('単価 1')).toHaveValue('5000')
  await expect(page.getByLabel('単価 1')).not.toHaveAttribute('aria-invalid', 'true')
})

test('巨大な値・値引き行・全行削除でも落ちない', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('単価 1').fill('999999999999')
  await expect(page.locator('#preview-total')).toContainText('¥')
  await page.getByLabel('単価 1').fill('99999999999999999999')
  await expect(page.getByLabel('単価 1')).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: '明細 1 を削除' }).click()
  await expect(page.getByLabel('品名 1')).toBeVisible()
  await expect(page.locator('#preview-total')).toHaveText('¥0')
})

test('HTMLタグを含む入力は文字列として表示され、実行されない', async ({ page }) => {
  let dialogSeen = false
  page.on('dialog', () => (dialogSeen = true))
  await page.goto('/')
  await page.locator('#client-name').fill('<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview .client')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('#preview img')).toHaveCount(0)
  expect(dialogSeen).toBe(false)
})

test('スマホ幅・PC幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})

test('印刷時は入力フォームが非表示になりプレビューだけが残る', async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#preview')).toBeVisible()
  await expect(page.locator('#issuer-name')).toBeHidden()
  await expect(page.getByRole('button', { name: 'CSVをダウンロード' })).toBeHidden()
})

test('CSVのファイル名は日本語の請求書番号を除去して英数字のみにする', async ({ page }) => {
  await page.goto('/')
  await page.locator('#inv-number').fill('第１号')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSVをダウンロード' }).click()])
  expect(download.suggestedFilename()).toMatch(/^invoice-1-\d{4}-\d{2}-\d{2}\.csv$|^invoice-\d{4}-\d{2}-\d{2}\.csv$/)
})

test.describe('オフライン', () => {
  test('プレビューサーバーを実際に停止してもキャッシュから起動・操作できる', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'オフライン検証はデスクトップChromiumのみ')
    test.setTimeout(120000)
    const dist = path.resolve('dist')
    expect(fs.existsSync(dist)).toBe(true)
    const port = 4199
    const server: ChildProcess = spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' })
    try {
      const url = `http://127.0.0.1:${port}/`
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(url)
          if (r.ok) break
        } catch {
          /* 起動待ち */
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      await page.goto(url)
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
      await page.reload() // SW制御下にする
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
      server.kill('SIGKILL')
      try {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
      } catch {
        /* 既に停止 */
      }
      await new Promise((r) => setTimeout(r, 1000))
      await page.reload()
      await expect(page.getByRole('heading', { name: 'インボイス対応 請求書メーカー' })).toBeVisible()
      await page.getByLabel('単価 1').fill('2000')
      await expect(page.locator('#preview-total')).toHaveText('¥2,200')
    } finally {
      server.kill('SIGKILL')
    }
  })
})
