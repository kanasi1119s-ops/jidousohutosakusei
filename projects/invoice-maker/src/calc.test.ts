import { describe, expect, it } from 'vitest'
import {
  calculateInvoice,
  isValidRegistrationNumber,
  normalizeNumberText,
  parseNumberInput,
  roundYen,
  withholdingTaxOf,
  type InvoiceInput,
} from './calc'

const base = (over: Partial<InvoiceInput>): InvoiceInput => ({
  items: [],
  priceMode: 'exclusive',
  rounding: 'floor',
  withholding: false,
  ...over,
})

describe('calculateInvoice', () => {
  it('10%と8%を税率ごとに集計する（税抜入力）', () => {
    const r = calculateInvoice(
      base({
        items: [
          { name: 'a', quantity: 1, unitPrice: 10000, taxRate: 10 },
          { name: 'b', quantity: 2, unitPrice: 500, taxRate: 8 },
        ],
      }),
    )
    expect(r.summaries.find((s) => s.taxRate === 10)).toMatchObject({ netTotal: 10000, tax: 1000 })
    expect(r.summaries.find((s) => s.taxRate === 8)).toMatchObject({ netTotal: 1000, tax: 80 })
    expect(r.grossTotal).toBe(12080)
  })

  it('端数処理は税率ごとに1回（明細ごとではない）', () => {
    // 各明細 33円 ×3行 = 99円。明細ごとに切り捨てると 3*3=9円だが、合計99円×10%=9.9→9円
    const items = Array.from({ length: 3 }, () => ({ name: 'x', quantity: 1, unitPrice: 33, taxRate: 10 as const }))
    expect(calculateInvoice(base({ items })).taxTotal).toBe(9)
    expect(calculateInvoice(base({ items, rounding: 'ceil' })).taxTotal).toBe(10)
    expect(calculateInvoice(base({ items, rounding: 'round' })).taxTotal).toBe(10)
  })

  it('税込入力: 税込1100円は税抜1000円・税100円', () => {
    const r = calculateInvoice(
      base({ priceMode: 'inclusive', items: [{ name: 'a', quantity: 1, unitPrice: 1100, taxRate: 10 }] }),
    )
    expect(r.netTotal).toBe(1000)
    expect(r.taxTotal).toBe(100)
    expect(r.grossTotal).toBe(1100)
  })

  it('非課税は消費税0', () => {
    const r = calculateInvoice(base({ items: [{ name: 'a', quantity: 1, unitPrice: 5000, taxRate: 0 }] }))
    expect(r.taxTotal).toBe(0)
    expect(r.grossTotal).toBe(5000)
  })

  it('源泉徴収: 税抜100万円以下は10.21%', () => {
    const r = calculateInvoice(
      base({ withholding: true, items: [{ name: 'a', quantity: 1, unitPrice: 100000, taxRate: 10 }] }),
    )
    expect(r.withholdingTax).toBe(10210)
    expect(r.payable).toBe(110000 - 10210)
  })

  it('空の明細は全て0', () => {
    const r = calculateInvoice(base({}))
    expect(r.grossTotal).toBe(0)
    expect(r.payable).toBe(0)
  })

  it('小数の数量でも浮動小数点誤差が出ない', () => {
    const r = calculateInvoice(base({ items: [{ name: 'a', quantity: 3, unitPrice: 1.1, taxRate: 0 }] }))
    expect(r.lineAmounts[0]).toBe(3)
    expect(roundYen(3.3000000000000003, 'ceil')).toBe(4)
  })
})

describe('withholdingTaxOf', () => {
  it('境界値', () => {
    expect(withholdingTaxOf(0)).toBe(0)
    expect(withholdingTaxOf(1_000_000)).toBe(102_100)
    expect(withholdingTaxOf(1_000_001)).toBe(102_100)
    expect(withholdingTaxOf(2_000_000)).toBe(102_100 + 204_200)
  })
})

describe('入力の正規化', () => {
  it('全角数字・カンマ・円記号を半角数値にする', () => {
    expect(normalizeNumberText('１，２３４円')).toBe('1234')
    expect(parseNumberInput('１２３４')).toBe(1234)
    expect(parseNumberInput('abc')).toBe(0)
    expect(parseNumberInput('-5')).toBe(0)
    expect(parseNumberInput('-5', { allowNegative: true })).toBe(-5)
    expect(parseNumberInput('99999999999999')).toBe(999_999_999)
  })
  it('登録番号の検証', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('')).toBe(false)
  })
})
