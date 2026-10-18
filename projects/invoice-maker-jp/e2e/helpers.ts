import type { Page } from '@playwright/test'

export async function fillBasic(page: Page): Promise<void> {
  await page.fill('#issuer-name', '山田商店')
  await page.fill('#issuer-reg', 'T1234567890123')
  await page.fill('#issuer-address', '東京都千代田区1-1-1')
  await page.fill('#doc-number', 'INV-2026-0001')
  await page.fill('#doc-trans', '2026年10月分')
  await page.fill('#doc-client', '株式会社テスト')
  const row = page.locator('.item-row').first()
  await row.locator('.item-name').fill('制作費')
  await row.locator('.item-qty').fill('1')
  await row.locator('.item-price').fill('10000')
}
