import type { Page } from '@playwright/test'

export async function fillIssuer(page: Page): Promise<void> {
  await page.fill('#issuer-name', '山田デザイン事務所')
  await page.fill('#issuer-reg', 'Ｔ１２３４５６７８９０１２３')
  await page.fill('#issuer-address', '東京都千代田区1-1-1')
  await page.fill('#issuer-bank', 'サンプル銀行 本店 普通 1234567')
}

export async function fillBasicInvoice(page: Page): Promise<void> {
  await fillIssuer(page)
  await page.fill('#inv-client', '株式会社サンプル')
  await page.fill('#inv-issue', '2026-10-20')
  const row = page.locator('#item-rows tr').first()
  await row.locator('.r-name').fill('ロゴ制作')
  await row.locator('.r-qty').fill('１')
  await row.locator('.r-price').fill('１０，０００')
}
