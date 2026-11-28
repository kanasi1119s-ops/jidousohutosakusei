import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('不正な入力はエラー表示になりクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salary', 'abc')
  await expect(page.locator('#input-error')).toContainText('給与収入')
  await page.fill('#salary', '')
  await expect(page.locator('#input-error')).toContainText('入力してください')
  await page.fill('#salary', '-5')
  await expect(page.locator('#input-error')).toBeVisible()
  await page.fill('#salary', '99999999999999999999')
  await expect(page.locator('#input-error')).toBeVisible()
})

test('巨大な年収でもクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salary', '900000000')
  await expect(page.locator('#input-error')).toBeHidden()
  await expect(page.locator('#limit')).toContainText('円')
})

test('保存された入力がリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salary', '7777000')
  await page.selectOption('#spouse', 'special')
  await page.reload()
  await expect(page.locator('#salary')).toHaveValue('7777000')
  await expect(page.locator('#spouse')).toHaveValue('special')
})

test('JSONの書き出し→リセット→読み込みで往復できる', async ({ page }) => {
  await page.goto('/')
  await page.fill('#salary', '4321000')
  await page.fill('#depGeneral', '2')
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-json')])
  expect(download.suggestedFilename()).toBe('furusato-limit-settings.json')
  const file = (await download.path())!
  await page.click('#btn-reset')
  await expect(page.locator('#salary')).toHaveValue('5000000')
  await page.setInputFiles('#file-import', file)
  await expect(page.locator('#salary')).toHaveValue('4321000')
  await expect(page.locator('#depGeneral')).toHaveValue('2')
})

test('壊れたJSONの読み込みはエラーメッセージを出す', async ({ page }, testInfo) => {
  await page.goto('/')
  const bad = testInfo.outputPath('bad.json')
  fs.writeFileSync(bad, '{"salaryYen":"x"}', 'utf-8')
  await page.setInputFiles('#file-import', bad)
  await expect(page.locator('#data-message')).toContainText('形式が不正')
})

test('スマホ幅・PC幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow, `width=${width}`).toBe(false)
  }
})

test('オフライン（ネットワーク切断）でもコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('ふるさと納税 上限額シミュレーター')
  await page.fill('#salary', '8000000')
  await expect(page.locator('#limit')).toContainText('円')
  await context.setOffline(false)
})

test('外部ドメインへの通信が発生しない', async ({ page }) => {
  const external: string[] = []
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(req.url())
  })
  await page.goto('/')
  await page.fill('#salary', '6000000')
  expect(external).toEqual([])
})
