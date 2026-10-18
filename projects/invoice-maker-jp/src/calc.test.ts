import { describe, expect, it } from 'vitest'
import { applyRounding, computeTotals, formatYen, lineAmount, parseNumber, toHalfWidth } from './calc'

describe('toHalfWidth / parseNumber', () => {
  it('全角数字を半角にする', () => {
    expect(toHalfWidth('１，２３４')).toBe('1,234')
    expect(parseNumber('１２３４')).toBe(1234)
    expect(parseNumber('１,２３４.５')).toBe(1234.5)
    expect(parseNumber('－５００')).toBe(-500)
  })
  it('不正な形式は null', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1e5')).toBeNull()
    expect(parseNumber('1.2.3')).toBeNull()
  })
})

describe('applyRounding', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(applyRounding(15, 10, 'floor')).toBe(1)
    expect(applyRounding(15, 10, 'round')).toBe(2)
    expect(applyRounding(14, 10, 'round')).toBe(1)
    expect(applyRounding(11, 10, 'ceil')).toBe(2)
    expect(applyRounding(10, 10, 'ceil')).toBe(1)
  })
  it('負数は絶対値で丸めて符号を戻す', () => {
    expect(applyRounding(-15, 10, 'round')).toBe(-2)
    expect(applyRounding(-11, 10, 'floor')).toBe(-1)
    expect(applyRounding(0, 10, 'floor')).toBe(0)
    expect(Object.is(applyRounding(-1, 10, 'floor'), -0)).toBe(false)
  })
})

describe('lineAmount', () => {
  it('小数数量でも浮動小数点誤差が出ない', () => {
    expect(lineAmount({ name: 'a', quantity: 1.1, unitPriceYen: 100, taxRate: 10 }, 'floor')).toBe(110)
    expect(lineAmount({ name: 'a', quantity: 0.07, unitPriceYen: 100, taxRate: 10 }, 'floor')).toBe(7)
    expect(lineAmount({ name: 'a', quantity: 2.5, unitPriceYen: 333, taxRate: 10 }, 'floor')).toBe(832)
    expect(lineAmount({ name: 'a', quantity: 2.5, unitPriceYen: 333, taxRate: 10 }, 'round')).toBe(833)
  })
})

describe('computeTotals', () => {
  it('税抜入力: 税率ごとに1回だけ端数処理する', () => {
    const t = computeTotals(
      [
        { name: 'a', quantity: 1, unitPriceYen: 333, taxRate: 10 },
        { name: 'b', quantity: 1, unitPriceYen: 333, taxRate: 10 },
        { name: 'c', quantity: 1, unitPriceYen: 333, taxRate: 10 },
        { name: 'd', quantity: 1, unitPriceYen: 105, taxRate: 8 },
      ],
      'exclusive',
      'floor',
    )
    // 10%: 999 → 99.9 → 99 / 8%: 105 → 8.4 → 8（明細ごとの端数処理だと 33*3=99 で同じだが集計方式を固定）
    expect(t.byRate).toEqual([
      { rate: 10, base: 999, tax: 99, total: 1098 },
      { rate: 8, base: 105, tax: 8, total: 113 },
    ])
    expect(t.subtotal).toBe(1104)
    expect(t.tax).toBe(107)
    expect(t.total).toBe(1211)
  })
  it('明細ごとに端数処理すると差が出るケースで、税率ごと集計になっている', () => {
    const items = Array.from({ length: 3 }, () => ({ name: 'x', quantity: 1, unitPriceYen: 15, taxRate: 10 as const }))
    const t = computeTotals(items, 'exclusive', 'floor')
    // 明細ごと: 1+1+1=3 / 税率ごと: 45*10% = 4.5 → 4
    expect(t.tax).toBe(4)
  })
  it('税込入力: 税込合計から内税額を逆算する', () => {
    const t = computeTotals(
      [
        { name: 'a', quantity: 1, unitPriceYen: 1100, taxRate: 10 },
        { name: 'b', quantity: 2, unitPriceYen: 540, taxRate: 8 },
      ],
      'inclusive',
      'floor',
    )
    expect(t.byRate).toEqual([
      { rate: 10, base: 1000, tax: 100, total: 1100 },
      { rate: 8, base: 1000, tax: 80, total: 1080 },
    ])
    expect(t.total).toBe(2180)
  })
  it('端数処理の方式で結果が変わる', () => {
    const items = [{ name: 'a', quantity: 1, unitPriceYen: 1005, taxRate: 10 as const }]
    expect(computeTotals(items, 'exclusive', 'floor').tax).toBe(100)
    expect(computeTotals(items, 'exclusive', 'round').tax).toBe(101)
    expect(computeTotals(items, 'exclusive', 'ceil').tax).toBe(101)
  })
  it('値引き行（負の単価）を扱える', () => {
    const t = computeTotals(
      [
        { name: 'a', quantity: 1, unitPriceYen: 1000, taxRate: 10 },
        { name: '値引き', quantity: 1, unitPriceYen: -100, taxRate: 10 },
      ],
      'exclusive',
      'floor',
    )
    expect(t.subtotal).toBe(900)
    expect(t.tax).toBe(90)
  })
  it('明細が空なら全て0', () => {
    const t = computeTotals([], 'exclusive', 'floor')
    expect(t.total).toBe(0)
    expect(t.byRate).toEqual([])
  })
})

describe('formatYen', () => {
  it('桁区切りと符号', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatYen(-1000)).toBe('-¥1,000')
    expect(formatYen(0)).toBe('¥0')
  })
})
