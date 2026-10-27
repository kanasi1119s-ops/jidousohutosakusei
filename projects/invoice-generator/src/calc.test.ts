import { describe, expect, it } from 'vitest'
import { calcInvoice, lineAmount, withholdingTax } from './calc'
import type { LineItem } from './types'

const item = (unitPrice: number, quantity: number, taxRate: 0 | 8 | 10 = 10): LineItem => ({
  id: 'x',
  name: 'n',
  quantity,
  unitPrice,
  taxRate,
})
const base = { priceMode: 'exclusive' as const, rounding: 'floor' as const, withholdingEnabled: false }

describe('lineAmount', () => {
  it('浮動小数点誤差を避ける（0.29 × 100 = 29）', () => {
    expect(lineAmount({ quantity: 0.29, unitPrice: 100 }, 'floor')).toBe(29)
    expect(lineAmount({ quantity: 1.1, unitPrice: 100 }, 'floor')).toBe(110)
  })
  it('端数処理モード', () => {
    const it = { quantity: 1.5, unitPrice: 101 } // 151.5
    expect(lineAmount(it, 'floor')).toBe(151)
    expect(lineAmount(it, 'round')).toBe(152)
    expect(lineAmount(it, 'ceil')).toBe(152)
  })
  it('値引き（マイナス単価）は0方向へ切り捨てる', () => {
    expect(lineAmount({ quantity: 1.5, unitPrice: -101 }, 'floor')).toBe(-151)
    expect(lineAmount({ quantity: 1.5, unitPrice: -101 }, 'round')).toBe(-152)
  })
  it('NaN は0円として扱う', () => {
    expect(lineAmount({ quantity: NaN, unitPrice: 100 }, 'floor')).toBe(0)
  })
})

describe('calcInvoice', () => {
  it('税抜入力: 税率ごとに1回だけ端数処理する', () => {
    // 10%: 333 + 333 + 333 = 999 → 税99.9 → 切捨て99。行ごとに処理すると 33*3 = 99 だが 1行 333*0.1=33.3 なので同値。
    // 8%: 125 → 10.0、 10%: 105×3 → 税31.5 → 切捨て31（行ごと切捨てなら 10*3 = 30 になり異なる）
    const t = calcInvoice({ ...base, items: [item(105, 1), item(105, 1), item(105, 1), item(125, 1, 8)] })
    const r10 = t.byRate.find((r) => r.rate === 10)!
    const r8 = t.byRate.find((r) => r.rate === 8)!
    expect(r10.net).toBe(315)
    expect(r10.tax).toBe(31)
    expect(r8.tax).toBe(10)
    expect(t.gross).toBe(315 + 31 + 125 + 10)
  })
  it('税込入力: 税込合計から税額を内税計算する', () => {
    const t = calcInvoice({ ...base, priceMode: 'inclusive', items: [item(1100, 1), item(108, 1, 8)] })
    expect(t.byRate[0]).toMatchObject({ rate: 10, net: 1000, tax: 100, gross: 1100 })
    expect(t.byRate[1]).toMatchObject({ rate: 8, net: 100, tax: 8, gross: 108 })
    expect(t.gross).toBe(1208)
  })
  it('税込入力: 端数処理が反映される', () => {
    // 1001円(税込10%) → 税 = 1001*10/110 = 91.0 、 1000円 → 90.909…
    expect(calcInvoice({ ...base, priceMode: 'inclusive', items: [item(1000, 1)] }).byRate[0].tax).toBe(90)
    expect(calcInvoice({ ...base, priceMode: 'inclusive', rounding: 'round', items: [item(1000, 1)] }).byRate[0].tax).toBe(91)
    expect(calcInvoice({ ...base, priceMode: 'inclusive', rounding: 'ceil', items: [item(1000, 1)] }).byRate[0].tax).toBe(91)
  })
  it('非課税行は税額0', () => {
    const t = calcInvoice({ ...base, items: [item(500, 2, 0)] })
    expect(t.tax).toBe(0)
    expect(t.gross).toBe(1000)
  })
  it('明細が空でも落ちない', () => {
    const t = calcInvoice({ ...base, items: [] })
    expect(t.gross).toBe(0)
    expect(t.byRate).toEqual([])
  })
  it('源泉徴収は税抜合計に対して計算し、差引額を出す', () => {
    const t = calcInvoice({ ...base, withholdingEnabled: true, items: [item(100000, 1)] })
    expect(t.withholding).toBe(10210)
    expect(t.gross).toBe(110000)
    expect(t.payable).toBe(110000 - 10210)
  })
})

describe('withholdingTax', () => {
  it('100万円以下は10.21%', () => {
    expect(withholdingTax(1_000_000)).toBe(102_100)
    expect(withholdingTax(99_999)).toBe(10_209) // 10209.8979 → 切捨て
  })
  it('100万円超の部分は20.42%', () => {
    expect(withholdingTax(1_000_001)).toBe(102_100)
    expect(withholdingTax(2_000_000)).toBe(102_100 + 204_200)
  })
  it('0以下・NaN は0', () => {
    expect(withholdingTax(0)).toBe(0)
    expect(withholdingTax(-5)).toBe(0)
    expect(withholdingTax(NaN)).toBe(0)
  })
})
