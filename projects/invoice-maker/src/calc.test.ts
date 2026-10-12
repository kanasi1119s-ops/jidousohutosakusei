import { describe, expect, it } from 'vitest'
import { calculate, lineAmount, roundDiv, withholdingTax, type LineItem } from './calc'

const item = (quantity: number, unitPriceYen: number, taxRate: 10 | 8 | 0 = 10): LineItem => ({
  id: 'x',
  name: 'n',
  quantity,
  unitPriceYen,
  taxRate,
})

describe('roundDiv', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(roundDiv(1005, 100, 'floor')).toBe(10)
    expect(roundDiv(1049, 100, 'round')).toBe(10)
    expect(roundDiv(1050, 100, 'round')).toBe(11)
    expect(roundDiv(1001, 100, 'ceil')).toBe(11)
    expect(roundDiv(1000, 100, 'ceil')).toBe(10)
  })
  it('負数は絶対値で処理する', () => {
    expect(roundDiv(-1099, 100, 'floor')).toBe(-10)
    expect(roundDiv(-1050, 100, 'round')).toBe(-11)
  })
})

describe('lineAmount', () => {
  it('小数の数量を扱う（1.5 × 999円 = 1498.5 → 切り捨て1498）', () => {
    expect(lineAmount(item(1.5, 999), 'floor')).toBe(1498)
    expect(lineAmount(item(1.5, 999), 'round')).toBe(1499)
  })
  it('浮動小数点誤差が出ない（0.1 × 3 の数量）', () => {
    expect(lineAmount(item(0.1 + 0.2, 1000), 'floor')).toBe(300)
  })
})

describe('calculate', () => {
  const opt = { priceMode: 'exclusive', rounding: 'floor', withholding: false } as const

  it('税率ごとに1回だけ端数処理する（行ごとに処理しない）', () => {
    // 各行 105円 × 10% = 10.5円。行ごとに切り捨てると 10×3=30円、合算してから処理すると 31円
    const r = calculate([item(1, 105), item(1, 105), item(1, 105)], opt)
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0].subtotalYen).toBe(315)
    expect(r.groups[0].taxYen).toBe(31)
    expect(r.totalYen).toBe(346)
  })

  it('標準税率と軽減税率を区分する', () => {
    const r = calculate([item(2, 1000, 10), item(3, 500, 8)], opt)
    expect(r.groups.map((g) => [g.taxRate, g.subtotalYen, g.taxYen])).toEqual([
      [10, 2000, 200],
      [8, 1500, 120],
    ])
    expect(r.totalYen).toBe(3820)
  })

  it('非課税は税額0', () => {
    const r = calculate([item(1, 5000, 0)], opt)
    expect(r.taxYen).toBe(0)
    expect(r.totalYen).toBe(5000)
  })

  it('税込入力: 税込合計から消費税額を内税として算出する', () => {
    const r = calculate([item(1, 1100, 10), item(1, 1080, 8)], { ...opt, priceMode: 'inclusive' })
    expect(r.groups.map((g) => [g.taxRate, g.subtotalYen, g.taxYen, g.totalYen])).toEqual([
      [10, 1000, 100, 1100],
      [8, 1000, 80, 1080],
    ])
    expect(r.totalYen).toBe(2180)
  })

  it('端数処理の方式で消費税額が変わる', () => {
    const items = [item(1, 105)]
    expect(calculate(items, { ...opt, rounding: 'floor' }).taxYen).toBe(10)
    expect(calculate(items, { ...opt, rounding: 'round' }).taxYen).toBe(11)
    expect(calculate(items, { ...opt, rounding: 'ceil' }).taxYen).toBe(11)
  })

  it('値引き（負の単価）を扱う', () => {
    const r = calculate([item(1, 10000), item(1, -1000)], opt)
    expect(r.subtotalYen).toBe(9000)
    expect(r.taxYen).toBe(900)
  })

  it('源泉徴収は税抜の報酬額に対して計算し、差引請求額を出す', () => {
    const r = calculate([item(1, 100000)], { ...opt, withholding: true })
    expect(r.withholdingYen).toBe(10210)
    expect(r.totalYen).toBe(110000)
    expect(r.payableYen).toBe(99790)
  })

  it('最大値付近でも整数のまま計算できる', () => {
    const r = calculate([item(9999.999, 999_999_999)], opt)
    expect(Number.isSafeInteger(r.totalYen)).toBe(true)
  })
})

describe('withholdingTax', () => {
  it('100万円以下は10.21%、超過分は20.42%', () => {
    expect(withholdingTax(100_000)).toBe(10_210)
    expect(withholdingTax(1_000_000)).toBe(102_100)
    expect(withholdingTax(1_500_000)).toBe(102_100 + 102_100)
  })
  it('1円未満は切り捨て', () => {
    expect(withholdingTax(12_345)).toBe(1_260) // 1260.4...
  })
  it('0や負数は0', () => {
    expect(withholdingTax(0)).toBe(0)
    expect(withholdingTax(-5)).toBe(0)
  })
})
