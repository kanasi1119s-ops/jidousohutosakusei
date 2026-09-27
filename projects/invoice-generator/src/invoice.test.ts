import { describe, expect, it } from 'vitest'
import {
  computeInvoiceTotals,
  lineAmountYen,
  validateInvoice,
  validateItem,
  validateRegistrationNumber,
  type InvoiceItem,
} from './invoice'

describe('lineAmountYen', () => {
  it('数量×単価を四捨五入で返す', () => {
    expect(lineAmountYen({ name: 'a', quantity: 3, unitPriceYen: 1000, taxRate: 10 })).toBe(3000)
    expect(lineAmountYen({ name: 'a', quantity: 1.5, unitPriceYen: 999, taxRate: 10 })).toBe(1499)
  })
})

describe('computeInvoiceTotals', () => {
  it('税率ごとに区分して消費税額を計算する（インボイス要件）', () => {
    const items: InvoiceItem[] = [
      { name: '設計費', quantity: 1, unitPriceYen: 100000, taxRate: 10 },
      { name: '飲食代（会議費）', quantity: 1, unitPriceYen: 1000, taxRate: 8 },
      { name: '非課税品', quantity: 1, unitPriceYen: 500, taxRate: 0 },
    ]
    const totals = computeInvoiceTotals(items)
    expect(totals.rateGroups).toHaveLength(3)

    const g10 = totals.rateGroups.find((g) => g.taxRate === 10)!
    expect(g10.subtotalYen).toBe(100000)
    expect(g10.taxYen).toBe(10000)

    const g8 = totals.rateGroups.find((g) => g.taxRate === 8)!
    expect(g8.subtotalYen).toBe(1000)
    expect(g8.taxYen).toBe(80)

    const g0 = totals.rateGroups.find((g) => g.taxRate === 0)!
    expect(g0.taxYen).toBe(0)

    expect(totals.grandSubtotalYen).toBe(101500)
    expect(totals.grandTaxYen).toBe(10080)
    expect(totals.grandTotalYen).toBe(111580)
  })

  it('端数処理は品目ごとではなく税率ごとに1回だけ行う', () => {
    // 1個333円(税抜)を3個 → 品目ごとに計算すると誤差が出るケース
    const items: InvoiceItem[] = [
      { name: 'A', quantity: 1, unitPriceYen: 333, taxRate: 10 },
      { name: 'B', quantity: 1, unitPriceYen: 333, taxRate: 10 },
      { name: 'C', quantity: 1, unitPriceYen: 333, taxRate: 10 },
    ]
    const totals = computeInvoiceTotals(items)
    // 999 * 0.1 = 99.9 → 税率ごとに1回四捨五入すると100円
    expect(totals.grandTaxYen).toBe(100)
  })

  it('品目がない税率のグループは含めない', () => {
    const totals = computeInvoiceTotals([{ name: 'A', quantity: 1, unitPriceYen: 1000, taxRate: 10 }])
    expect(totals.rateGroups).toHaveLength(1)
  })
})

describe('validateItem', () => {
  it('品目名が空ならエラー', () => {
    expect(validateItem({ name: '', quantity: 1, unitPriceYen: 100, taxRate: 10 })).toContain(
      '品目名を入力してください。',
    )
  })
  it('数量が0以下ならエラー', () => {
    expect(validateItem({ name: 'a', quantity: 0, unitPriceYen: 100, taxRate: 10 }).length).toBeGreaterThan(0)
  })
  it('単価が負ならエラー', () => {
    expect(validateItem({ name: 'a', quantity: 1, unitPriceYen: -1, taxRate: 10 }).length).toBeGreaterThan(0)
  })
  it('正常な品目はエラーなし', () => {
    expect(validateItem({ name: 'a', quantity: 1, unitPriceYen: 100, taxRate: 10 })).toHaveLength(0)
  })
})

describe('validateInvoice', () => {
  it('取引先名・発行日・品目のいずれかが欠けるとエラー', () => {
    const errors = validateInvoice({ clientName: '', issueDate: '', items: [] })
    expect(errors).toContain('取引先名を入力してください。')
    expect(errors).toContain('発行日を入力してください。')
    expect(errors).toContain('品目を1つ以上追加してください。')
  })
})

describe('validateRegistrationNumber', () => {
  it('未入力はエラー', () => {
    expect(validateRegistrationNumber('').length).toBeGreaterThan(0)
  })
  it('T+13桁以外の形式はエラー', () => {
    expect(validateRegistrationNumber('1234567890123').length).toBeGreaterThan(0)
    expect(validateRegistrationNumber('T123').length).toBeGreaterThan(0)
  })
  it('正しい形式はエラーなし', () => {
    expect(validateRegistrationNumber('T1234567890123')).toHaveLength(0)
  })
})
