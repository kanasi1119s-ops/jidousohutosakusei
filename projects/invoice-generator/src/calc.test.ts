import { describe, expect, it } from 'vitest'
import {
  computeInvoice,
  divideRounded,
  formatYen,
  isValidRegistrationNumber,
  lineAmount,
  normalizeRegistrationNumber,
  parseNumberInput,
  withholdingTax,
} from './calc'

describe('divideRounded', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(divideRounded(105, 10, 'floor')).toBe(10)
    expect(divideRounded(105, 10, 'round')).toBe(11)
    expect(divideRounded(104, 10, 'round')).toBe(10)
    expect(divideRounded(101, 10, 'ceil')).toBe(11)
    expect(divideRounded(100, 10, 'ceil')).toBe(10)
  })
})

describe('lineAmount', () => {
  it('小数の数量でも浮動小数点誤差が出ない', () => {
    expect(lineAmount(0.1, 30, 'floor')).toBe(3)
    expect(lineAmount(1.1, 100, 'floor')).toBe(110)
    expect(lineAmount(2.5, 1001, 'floor')).toBe(2502)
    expect(lineAmount(2.5, 1001, 'ceil')).toBe(2503)
  })
  it('数量0以下は0', () => {
    expect(lineAmount(0, 100, 'floor')).toBe(0)
    expect(lineAmount(-1, 100, 'floor')).toBe(0)
  })
  it('マイナス単価（値引き）を扱える', () => {
    expect(lineAmount(1, -500, 'floor')).toBe(-500)
  })
})

describe('computeInvoice', () => {
  it('税抜入力: 税率ごとに合計してから消費税を1回だけ端数処理する', () => {
    // 行ごとに処理すると 33+33+33=99 だが、合計 335円 の10% = 33.5 → 切り捨て 33
    const t = computeInvoice(
      [
        { name: 'a', qty: 1, unitPrice: 111, rate: 10 },
        { name: 'b', qty: 1, unitPrice: 112, rate: 10 },
        { name: 'c', qty: 1, unitPrice: 112, rate: 10 },
      ],
      'exclusive',
      'floor',
      false,
    )
    expect(t.groups).toHaveLength(1)
    expect(t.groups[0]).toEqual({ rate: 10, subtotal: 335, tax: 33, total: 368 })
    expect(t.total).toBe(368)
  })
  it('10%と8%が混在する', () => {
    const t = computeInvoice(
      [
        { name: 'a', qty: 2, unitPrice: 1000, rate: 10 },
        { name: 'b', qty: 3, unitPrice: 150, rate: 8 },
      ],
      'exclusive',
      'floor',
      false,
    )
    expect(t.groups.map((g) => [g.rate, g.subtotal, g.tax])).toEqual([
      [10, 2000, 200],
      [8, 450, 36],
    ])
    expect(t.subtotal).toBe(2450)
    expect(t.tax).toBe(236)
    expect(t.total).toBe(2686)
  })
  it('税込入力: 税込合計から税額を内税計算する', () => {
    const t = computeInvoice([{ name: 'a', qty: 1, unitPrice: 1100, rate: 10 }], 'inclusive', 'floor', false)
    expect(t.groups[0]).toEqual({ rate: 10, subtotal: 1000, tax: 100, total: 1100 })
    const t8 = computeInvoice([{ name: 'a', qty: 1, unitPrice: 1000, rate: 8 }], 'inclusive', 'floor', false)
    expect(t8.groups[0].tax).toBe(74) // 1000*8/108 = 74.07
    expect(t8.total).toBe(1000)
  })
  it('端数処理方式の違い', () => {
    const lines = [{ name: 'a', qty: 1, unitPrice: 105, rate: 10 as const }]
    expect(computeInvoice(lines, 'exclusive', 'floor', false).tax).toBe(10)
    expect(computeInvoice(lines, 'exclusive', 'round', false).tax).toBe(11)
    expect(computeInvoice(lines, 'exclusive', 'ceil', false).tax).toBe(11)
  })
  it('明細なし・空は0円', () => {
    const t = computeInvoice([], 'exclusive', 'floor', true)
    expect(t.total).toBe(0)
    expect(t.withholding).toBe(0)
  })
  it('源泉徴収を差し引く', () => {
    const t = computeInvoice([{ name: 'a', qty: 1, unitPrice: 100000, rate: 10 }], 'exclusive', 'floor', true)
    expect(t.total).toBe(110000)
    expect(t.withholding).toBe(10210)
    expect(t.payable).toBe(99790)
  })
  it('巨大な金額でも整数のまま計算できる', () => {
    const t = computeInvoice([{ name: 'a', qty: 1, unitPrice: 999_999_999_999, rate: 10 }], 'exclusive', 'floor', false)
    expect(t.tax).toBe(99_999_999_999)
  })
})

describe('withholdingTax', () => {
  it('100万円以下は10.21%、超過分は20.42%', () => {
    expect(withholdingTax(1_000_000)).toBe(102_100)
    expect(withholdingTax(1_000_001)).toBe(102_100) // 20.42% * 1 = 0.2042 → 切り捨て
    expect(withholdingTax(1_100_000)).toBe(102_100 + 20_420)
    expect(withholdingTax(0)).toBe(0)
    expect(withholdingTax(-5)).toBe(0)
  })
  it('1円未満は切り捨て', () => {
    expect(withholdingTax(333)).toBe(33) // 33.9993 → 切り捨て
  })
})

describe('登録番号・数値入力', () => {
  it('形式判定（全角・ハイフン・小文字も受け付ける）', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('t1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T-1234-5678-90123')).toBe(true)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('')).toBe(false)
    expect(normalizeRegistrationNumber('Ｔ１２３ ４５')).toBe('T12345')
  })
  it('全角数字・カンマ入力を数値化する', () => {
    expect(parseNumberInput('１，２３４')).toBe(1234)
    expect(parseNumberInput('1,234.5')).toBe(1234.5)
    expect(parseNumberInput('－５００')).toBe(-500)
    expect(parseNumberInput('')).toBeNaN()
    expect(parseNumberInput('abc')).toBeNaN()
  })
  it('円表記', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatYen(-500)).toBe('-¥500')
  })
})
