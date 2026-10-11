import { test, expect } from '@playwright/test'

test('入力はリロード後も復元される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-name', '復元テスト')
  await page.fill('[aria-label="明細1の品名"]', '保守費用')
  await page.fill('[aria-label="明細1の単価"]', '12345')
  await page.reload()
  await expect(page.locator('#issuer-name')).toHaveValue('復元テスト')
  await expect(page.locator('[aria-label="明細1の品名"]')).toHaveValue('保守費用')
  await expect(page.locator('[aria-label="明細1の単価"]')).toHaveValue('12345')
})

test('巨大な値でもクラッシュしない', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.fill('[aria-label="明細1の品名"]', 'x')
  await page.fill('[aria-label="明細1の単価"]', '99999999999999999999')
  await page.fill('[aria-label="明細1の数量"]', '99999999999')
  await expect(page.locator('#invoice-preview .grand-amount')).toBeVisible()
  expect(errors).toEqual([])
})

test('不正な文字列の単価は0として扱われる', async ({ page }) => {
  await page.goto('/')
  await page.fill('[aria-label="明細1の品名"]', 'x')
  await page.fill('[aria-label="明細1の単価"]', 'あいう')
  await expect(page.locator('#invoice-preview .grand-amount')).toHaveText('¥0')
})

test('登録番号の形式エラーが表示され、全角入力は正規化される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-reg', 'T123')
  await expect(page.locator('#reg-message')).toContainText('形式が正しくありません')
  await page.fill('#issuer-reg', 'ｔ１２３４５６７８９０１２３')
  await page.locator('#issuer-reg').blur()
  await expect(page.locator('#issuer-reg')).toHaveValue('T1234567890123')
  await expect(page.locator('#reg-message')).toContainText('形式は正しいです')
})

test('HTMLを含む入力はタグとして解釈されない（XSS対策）', async ({ page }) => {
  await page.goto('/')
  await page.fill('#inv-recipient', '<img src=x onerror="window.__xss=1">')
  await page.fill('#issuer-name', '<script>window.__xss=1</script>')
  await expect(page.locator('#invoice-preview img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(page.locator('#invoice-preview')).toContainText('<img src=x')
})

test('明細を全部削除しても空行が残りクラッシュしない', async ({ page }) => {
  await page.goto('/')
  await page.click('[aria-label="明細1を削除"]')
  await expect(page.locator('#lines-body tr')).toHaveCount(1)
})

test('請求書の新規作成・複製・切り替え・削除', async ({ page }) => {
  await page.goto('/')
  await page.fill('#inv-recipient', 'A社')
  await page.click('#new-invoice')
  await expect(page.locator('#invoice-select option')).toHaveCount(2)
  await expect(page.locator('#inv-recipient')).toHaveValue('')
  await page.fill('#inv-recipient', 'B社')
  await page.click('#duplicate-invoice')
  await expect(page.locator('#invoice-select option')).toHaveCount(3)
  await expect(page.locator('#inv-recipient')).toHaveValue('B社')
  const numbers = await page.locator('#invoice-select option').allTextContents()
  expect(new Set(numbers.map((t) => t.split(' / ')[0])).size).toBe(3)

  page.on('dialog', (d) => d.accept())
  await page.click('#delete-invoice')
  await expect(page.locator('#invoice-select option')).toHaveCount(2)
})

test('不正なJSONを読み込むとエラー表示で既存データは壊れない', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.fill('#issuer-name', '残るべきデータ')
  const bad = testInfo.outputPath('bad.json')
  const fs = await import('node:fs')
  fs.writeFileSync(bad, '{"version":1,"invoices":"oops"}')
  await page.setInputFiles('#import-json', bad)
  await expect(page.locator('#status')).toContainText('読み込みに失敗しました')
  await expect(page.locator('#issuer-name')).toHaveValue('残るべきデータ')
})

test('PC幅・スマホ幅で横スクロールが発生しない', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.fill('#inv-recipient', '非常に長い名前の株式会社テスト商事ホールディングスグループ本社')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow, `width=${width}`).toBe(false)
  }
})

test('印刷スタイルではプレビューのみが表示される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#inv-recipient', '印刷テスト')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.editor')).toBeHidden()
  await expect(page.locator('#invoice-preview')).toBeVisible()
  const pdf = await page.pdf({ format: 'A4' })
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
})

test('オフライン（ネットワーク切断）でも作成・保存できる', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 })
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('h1')).toHaveText('インボイス対応 請求書メーカー')
  await page.fill('[aria-label="明細1の品名"]', 'オフライン作業')
  await page.fill('[aria-label="明細1の単価"]', '1000')
  await expect(page.locator('#invoice-preview .grand-amount')).toHaveText('¥1,100')
  await context.setOffline(false)
})

test('宛名を入力すると保存済み一覧の表示名も更新される', async ({ page }) => {
  await page.goto('/')
  await page.fill('#inv-recipient', '更新確認株式会社')
  await expect(page.locator('#invoice-select option:checked')).toContainText('更新確認株式会社')
})

test('PC幅で明細の金額列が切れずに表示される', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const cell = page.locator('td.amount').first()
  const wrap = page.locator('.table-scroll')
  const cb = (await cell.boundingBox())!
  const wb = (await wrap.boundingBox())!
  expect(cb.x + cb.width).toBeLessThanOrEqual(wb.x + wb.width + 1)
})

test('OKの項目にはエラー用のヒントを出さない', async ({ page }) => {
  await page.goto('/')
  await page.fill('#issuer-name', '山田')
  await expect(page.locator('#check-list li.ok', { hasText: '発行事業者の氏名' }).locator('.hint')).toHaveCount(0)
})
