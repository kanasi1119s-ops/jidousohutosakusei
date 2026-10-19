import { describe, expect, it } from 'vitest'
import { calcTotals, divideWithRounding, isValidRegistrationNumber, lineAmount, parseNumber, toHalfWidth, withholdingTax } from './calc'

describe('正規化', () => {
  it('全角数字・カンマを半角数値として解釈する', () => {
    expect(toHalfWidth('１２３ＡＢＣ')).toBe('123ABC')
    expect(parseNumber('１，２００')).toBe(1200)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
  it('登録番号の形式チェック', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('端数処理', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(divideWithRounding(15, 10, 'floor')).toBe(1)
    expect(divideWithRounding(15, 10, 'round')).toBe(2)
    expect(divideWithRounding(14, 10, 'round')).toBe(1)
    expect(divideWithRounding(11, 10, 'ceil')).toBe(2)
    expect(divideWithRounding(20, 10, 'ceil')).toBe(2)
  })
  it('小数の数量でも浮動小数誤差を出さない', () => {
    expect(lineAmount({ name: '', quantity: 0.1, unitPrice: 30, taxRate: 10 }, 'floor')).toBe(3)
    expect(lineAmount({ name: '', quantity: 1.005, unitPrice: 1000, taxRate: 10 }, 'floor')).toBe(1005)
  })
})

describe('請求額の計算', () => {
  it('税抜入力: 税率ごとに1回だけ消費税を計算する', () => {
    const t = calcTotals(
      [
        { name: 'a', quantity: 3, unitPrice: 333, taxRate: 10 },
        { name: 'b', quantity: 1, unitPrice: 333, taxRate: 10 },
        { name: 'c', quantity: 1, unitPrice: 199, taxRate: 8 },
      ],
      'exclusive',
      'floor',
      false,
    )
    // 10%: 1332 → 税133（行ごとに切り捨てると 99+33=132 になる）
    expect(t.groups[0]).toMatchObject({ rate: 10, base: 1332, tax: 133 })
    expect(t.groups[1]).toMatchObject({ rate: 8, base: 199, tax: 15 })
    expect(t.total).toBe(1332 + 133 + 199 + 15)
  })
  it('税込入力: 税込合計から消費税額を内訳として計算する', () => {
    const t = calcTotals([{ name: 'a', quantity: 1, unitPrice: 1100, taxRate: 10 }], 'inclusive', 'floor', false)
    expect(t.groups[0]).toMatchObject({ base: 1000, tax: 100, gross: 1100 })
    expect(t.total).toBe(1100)
  })
  it('非課税は消費税0', () => {
    const t = calcTotals([{ name: 'a', quantity: 1, unitPrice: 5000, taxRate: 0 }], 'exclusive', 'floor', false)
    expect(t.taxTotal).toBe(0)
    expect(t.total).toBe(5000)
  })
  it('値引き（マイナス明細）も計算できる', () => {
    const t = calcTotals(
      [
        { name: 'a', quantity: 1, unitPrice: 10000, taxRate: 10 },
        { name: '値引き', quantity: 1, unitPrice: -1000, taxRate: 10 },
      ],
      'exclusive',
      'floor',
      false,
    )
    expect(t.groups[0]).toMatchObject({ base: 9000, tax: 900 })
  })
  it('明細が空でも落ちない', () => {
    const t = calcTotals([], 'exclusive', 'floor', true)
    expect(t.total).toBe(0)
    expect(t.payable).toBe(0)
  })
})

describe('源泉徴収', () => {
  it('100万円以下は10.21%、超過分は20.42%（1円未満切り捨て）', () => {
    expect(withholdingTax(100000)).toBe(10210)
    expect(withholdingTax(1_000_000)).toBe(102100)
    expect(withholdingTax(2_000_000)).toBe(102100 + 204200)
    expect(withholdingTax(12345)).toBe(1260)
    expect(withholdingTax(0)).toBe(0)
  })
  it('請求額 = 税込合計 - 源泉徴収税額', () => {
    const t = calcTotals([{ name: 'a', quantity: 1, unitPrice: 100000, taxRate: 10 }], 'exclusive', 'floor', true)
    expect(t.total).toBe(110000)
    expect(t.withholding).toBe(10210)
    expect(t.payable).toBe(99790)
  })
})
