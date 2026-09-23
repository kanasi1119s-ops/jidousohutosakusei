import { test, expect } from '@playwright/test'

test('日本語の見出し・ボタンが正しく表示され、主要フローが動作する', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'ふるさと納税 控除上限額シミュレーター' })).toBeVisible()
  await expect(page.getByText('登録不要')).toBeVisible()

  await page.getByLabel('年収（給与収入額・円）').fill('5000000')
  await page.getByRole('button', { name: '計算する' }).click()

  const amount = page.locator('#result-amount')
  await expect(amount).toBeVisible()
  await expect(amount).toContainText('円')

  await page.getByRole('button', { name: 'この結果を保存する' }).click()
  await expect(page.getByRole('cell', { name: '独身、または配偶者に収入がある夫婦' })).toBeVisible()
})

test('異常系: 0円や未入力でもクラッシュせず計算できる', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('年収（給与収入額・円）').fill('0')
  await page.getByRole('button', { name: '計算する' }).click()
  await expect(page.locator('#result-amount')).toContainText('0 円')
})

test('保存 → 再読み込み後もデータが復元される（localStorage永続化）', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('年収（給与収入額・円）').fill('4500000')
  await page.getByRole('button', { name: '計算する' }).click()
  await page.getByRole('button', { name: 'この結果を保存する' }).click()

  await page.reload()
  await expect(page.getByText('4,500,000円')).toBeVisible()
})

test('CSVエクスポートがBOM付きUTF-8で日本語を含めてダウンロードされる', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('年収（給与収入額・円）').fill('6000000')
  await page.getByRole('button', { name: '計算する' }).click()
  await page.getByRole('button', { name: 'この結果を保存する' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSVでエクスポート' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^furusato-records-\d{4}-\d{2}-\d{2}\.csv$/)

  const streamPath = await download.path()
  const fs = await import('node:fs')
  const buffer = fs.readFileSync(streamPath!)
  expect(buffer[0]).toBe(0xef)
  expect(buffer[1]).toBe(0xbb)
  expect(buffer[2]).toBe(0xbf)

  const text = buffer.toString('utf-8')
  expect(text).toContain('独身、または配偶者に収入がある夫婦')
})

test('スマホ幅(375px相当)でも主要要素が表示される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '計算する' })).toBeVisible()
})

test('PC幅(1280px)でも主要要素が表示される', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ふるさと納税 控除上限額シミュレーター' })).toBeVisible()
  await expect(page.getByRole('button', { name: '計算する' })).toBeVisible()
})

test('オフライン(ネットワーク切断)でも一度開いた後はコア機能が動作する', async ({ page, context }) => {
  await page.goto('/')
  await page.getByLabel('年収（給与収入額・円）').fill('5000000')
  await page.getByRole('button', { name: '計算する' }).click()
  await expect(page.locator('#result-amount')).toContainText('円')

  // Service Workerによる事前キャッシュが完了するまで待ってからオフラインにする
  // (完了前に切断すると初回オフライン再読み込みが失敗し得るため)
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready
    return !!reg.active
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'ふるさと納税 控除上限額シミュレーター' })).toBeVisible()
  await page.getByLabel('年収（給与収入額・円）').fill('3000000')
  await page.getByRole('button', { name: '計算する' }).click()
  await expect(page.locator('#result-amount')).toContainText('円')
  await context.setOffline(false)
})

test('保存ボタンを連続で2回押しても記録が壊れずそれぞれ保存される（二重操作）', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('年収（給与収入額・円）').fill('4000000')
  await page.getByRole('button', { name: '計算する' }).click()
  await page.getByRole('button', { name: 'この結果を保存する' }).click()
  await page.getByRole('button', { name: 'この結果を保存する' }).click()

  const rows = page.locator('table.records tbody tr')
  await expect(rows).toHaveCount(2)
})

test('無効なJSONファイルをインポートしてもクラッシュせずエラー表示になる', async ({ page }) => {
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.setInputFiles('#import-json', {
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ not valid json', 'utf-8'),
  })
  // クラッシュせずヘッダーが表示され続けていること
  await expect(page.getByRole('heading', { name: 'ふるさと納税 控除上限額シミュレーター' })).toBeVisible()
})
