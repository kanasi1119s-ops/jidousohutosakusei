import { describe, expect, it } from 'vitest'
import { applyRounding, calcInvoice, parseNumberInput, withholdingTax } from './calc'

describe('parseNumberInput', () => {
  it('全角数字・カンマを正規化する', () => {
    expect(parseNumberInput('１，２３４')).toBe(1234)
    expect(parseNumberInput('１２．５')).toBe(12.5)
  })
  it('不正な文字列は NaN', () => {
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('')).toBeNaN()
  })
})

describe('calcInvoice', () => {
  it('税率ごとに1回だけ端数処理する（明細ごとではない）', () => {
    // 税抜 33円×3行 = 99円 → 10%: 9.9 → 切捨て9。明細ごと切捨てなら 3*3=9 で一致するため別ケースで検証
    const items = [
      { name: 'a', qty: 1, unitPrice: 15, taxRate: 10 as const },
      { name: 'b', qty: 1, unitPrice: 15, taxRate: 10 as const },
      { name: 'c', qty: 1, unitPrice: 15, taxRate: 10 as const },
    ]
    // 明細ごと切捨て: 1+1+1=3 / 合計45円の10%=4.5 → 切捨て4
    expect(calcInvoice(items, 'floor', false).tax).toBe(4)
    expect(calcInvoice(items, 'round', false).tax).toBe(5)
    expect(calcInvoice(items, 'ceil', false).tax).toBe(5)
  })
  it('10%と8%を区分して集計する', () => {
    const t = calcInvoice(
      [
        { name: 'a', qty: 2, unitPrice: 1000, taxRate: 10 },
        { name: 'b', qty: 1, unitPrice: 500, taxRate: 8 },
      ],
      'floor',
      false,
    )
    expect(t.byRate).toEqual([
      { rate: 10, subtotal: 2000, tax: 200 },
      { rate: 8, subtotal: 500, tax: 40 },
    ])
    expect(t.total).toBe(2740)
  })
  it('小数数量でも浮動小数点誤差が出ない', () => {
    const t = calcInvoice([{ name: 'a', qty: 0.1, unitPrice: 30, taxRate: 10 }], 'floor', false)
    expect(t.subtotal).toBe(3)
  })
  it('使われていない税率の行は出さない', () => {
    expect(calcInvoice([{ name: 'a', qty: 1, unitPrice: 100, taxRate: 10 }], 'floor', false).byRate).toHaveLength(1)
  })
  it('源泉徴収を差し引く', () => {
    const t = calcInvoice([{ name: 'a', qty: 1, unitPrice: 100000, taxRate: 10 }], 'floor', true)
    expect(t.withholding).toBe(10210)
    expect(t.total).toBe(100000 + 10000 - 10210)
  })
})

describe('withholdingTax', () => {
  it('100万円以下は10.21%、超過分は20.42%', () => {
    expect(withholdingTax(1_000_000)).toBe(102100)
    expect(withholdingTax(1_500_000)).toBe(102100 + 102100)
    expect(withholdingTax(-5)).toBe(0)
  })
})

describe('applyRounding', () => {
  it('各モード', () => {
    expect(applyRounding(2.5, 'floor')).toBe(2)
    expect(applyRounding(2.5, 'round')).toBe(3)
    expect(applyRounding(2.1, 'ceil')).toBe(3)
  })
})
