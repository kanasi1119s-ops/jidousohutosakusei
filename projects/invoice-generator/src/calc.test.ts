import { describe, expect, it } from 'vitest'
import {
  computeInvoice,
  formatJaDate,
  formatYen,
  isValidRegistrationNo,
  newInvoice,
  normalizeRegistrationNo,
  parseNumberInput,
  taxForSubtotal,
  withholdingTax,
  type Invoice,
} from './calc'

function invoiceWith(items: Invoice['items'], patch: Partial<Invoice> = {}): Invoice {
  return { ...newInvoice(new Date(2026, 9, 4)), items, ...patch }
}

describe('parseNumberInput', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumberInput('１２，３４５')).toBe(12345)
    expect(parseNumberInput('¥1,000')).toBe(1000)
    expect(parseNumberInput('１．５')).toBe(1.5)
    expect(parseNumberInput('－３００')).toBe(-300)
  })
  it('解釈できない入力は null', () => {
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
    expect(parseNumberInput('1e5')).toBeNull()
  })
})

describe('computeInvoice', () => {
  it('税率ごとに1回だけ端数処理する（行ごとではない）', () => {
    // 3行 × 税抜 333円 → 税率ごと合計 999円 → 消費税 99.9 → 切り捨て 99
    const inv = invoiceWith(
      [333, 333, 333].map((p) => ({ description: 'a', quantity: 1, unitPriceYen: p, taxRate: 10 as const })),
    )
    const r = computeInvoice(inv)
    expect(r.subtotalYen).toBe(999)
    expect(r.taxYen).toBe(99)
    expect(r.totalYen).toBe(1098)
  })
  it('10%と8%を区分して集計する', () => {
    const inv = invoiceWith([
      { description: '制作費', quantity: 1, unitPriceYen: 100000, taxRate: 10 },
      { description: '飲料', quantity: 10, unitPriceYen: 108, taxRate: 8 },
    ])
    const r = computeInvoice(inv)
    expect(r.summaries.map((s) => [s.rate, s.subtotalYen, s.taxYen])).toEqual([
      [10, 100000, 10000],
      [8, 1080, 86],
    ])
    expect(r.totalYen).toBe(100000 + 10000 + 1080 + 86)
  })
  it('端数処理の方式を切り替えられる', () => {
    const items = [{ description: 'a', quantity: 1, unitPriceYen: 105, taxRate: 10 as const }]
    expect(computeInvoice(invoiceWith(items, { rounding: 'floor' })).taxYen).toBe(10)
    expect(computeInvoice(invoiceWith(items, { rounding: 'round' })).taxYen).toBe(11)
    expect(computeInvoice(invoiceWith(items, { rounding: 'ceil' })).taxYen).toBe(11)
  })
  it('小数の数量でも浮動小数点誤差が出ない', () => {
    const inv = invoiceWith([{ description: 'a', quantity: 0.29, unitPriceYen: 100, taxRate: 10 }])
    expect(computeInvoice(inv).lineAmounts[0]).toBe(29)
  })
  it('値引き（負の単価）を扱える', () => {
    const inv = invoiceWith([
      { description: 'a', quantity: 1, unitPriceYen: 10000, taxRate: 10 },
      { description: '値引き', quantity: 1, unitPriceYen: -1000, taxRate: 10 },
    ])
    const r = computeInvoice(inv)
    expect(r.subtotalYen).toBe(9000)
    expect(r.taxYen).toBe(900)
  })
  it('源泉徴収を差し引いたご請求額を出す', () => {
    const inv = invoiceWith([{ description: 'a', quantity: 1, unitPriceYen: 100000, taxRate: 10 }], {
      withholding: true,
    })
    const r = computeInvoice(inv)
    expect(r.withholdingYen).toBe(10210)
    expect(r.payableYen).toBe(110000 - 10210)
  })
  it('空の請求書は0円', () => {
    const r = computeInvoice(invoiceWith([]))
    expect(r.totalYen).toBe(0)
    expect(r.summaries).toEqual([])
  })
})

describe('taxForSubtotal / withholdingTax', () => {
  it('四捨五入の境界', () => {
    expect(taxForSubtotal(105, 10, 'round')).toBe(11) // 10.5
    expect(taxForSubtotal(104, 10, 'round')).toBe(10) // 10.4
    expect(taxForSubtotal(1000, 8, 'ceil')).toBe(80)
  })
  it('源泉徴収: 100万円以下と超過', () => {
    expect(withholdingTax(1_000_000)).toBe(102_100)
    expect(withholdingTax(1_000_001)).toBe(102_100) // 0.2042円は切り捨て
    expect(withholdingTax(2_000_000)).toBe(102_100 + 204_200)
    expect(withholdingTax(0)).toBe(0)
    expect(withholdingTax(-5)).toBe(0)
  })
})

describe('登録番号・書式', () => {
  it('T+13桁のみ有効', () => {
    expect(isValidRegistrationNo('T1234567890123')).toBe(true)
    expect(isValidRegistrationNo('T123')).toBe(false)
    expect(isValidRegistrationNo('1234567890123')).toBe(false)
  })
  it('全角入力を正規化する', () => {
    expect(normalizeRegistrationNo('Ｔ１２３４５６７８９０１２３')).toBe('T1234567890123')
    expect(normalizeRegistrationNo('t1234567890123')).toBe('T1234567890123')
  })
  it('金額・日付の表示', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatJaDate('2026-10-04')).toBe('2026年10月4日')
    expect(formatJaDate('')).toBe('')
  })
})
