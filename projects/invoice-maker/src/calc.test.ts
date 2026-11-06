import { describe, expect, it } from 'vitest'
import {
  calcTotals,
  formatYen,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseNumber,
  type LineItem,
} from './calc'

const item = (unitPriceYen: number, taxRate: 10 | 8 | 0, quantity = 1): LineItem => ({
  name: 'x',
  quantity,
  unitPriceYen,
  taxRate,
})

describe('calcTotals', () => {
  it('10%の単純な合計', () => {
    const t = calcTotals([item(1000, 10)], 'floor')
    expect(t.subtotalYen).toBe(1000)
    expect(t.taxYen).toBe(100)
    expect(t.totalYen).toBe(1100)
  })
  it('税率ごとに1回だけ端数処理する（明細ごとの切り捨て合計と異なる）', () => {
    // 33円×3明細=99円。明細ごと切り捨てなら 3円×3=9円だが、合計99円の10%=9.9円→切り捨て9円
    // 15円×3明細(10%)=45円→4.5円。明細ごと切り捨てなら 1円×3=3円、税率別なら4円
    const t = calcTotals([item(15, 10), item(15, 10), item(15, 10)], 'floor')
    expect(t.byRate).toEqual([{ rate: 10, subtotalYen: 45, taxYen: 4 }])
  })
  it('10%と軽減8%を区分して集計する', () => {
    const t = calcTotals([item(1000, 10), item(500, 8, 3)], 'floor')
    expect(t.byRate).toEqual([
      { rate: 10, subtotalYen: 1000, taxYen: 100 },
      { rate: 8, subtotalYen: 1500, taxYen: 120 },
    ])
    expect(t.totalYen).toBe(2720)
  })
  it('端数処理の切り上げ・四捨五入・切り捨て', () => {
    const items = [item(15, 10)] // 1.5円
    expect(calcTotals(items, 'floor').taxYen).toBe(1)
    expect(calcTotals(items, 'ceil').taxYen).toBe(2)
    expect(calcTotals(items, 'round').taxYen).toBe(2)
  })
  it('値引き(負の金額)を扱える', () => {
    const t = calcTotals([item(10000, 10), item(-1000, 10)], 'floor')
    expect(t.subtotalYen).toBe(9000)
    expect(t.taxYen).toBe(900)
  })
  it('小数の数量でも浮動小数点誤差が出ない', () => {
    const t = calcTotals([item(1000, 10, 0.3)], 'floor') // 300円(0.3*1000=300.00000000000006対策)
    expect(t.subtotalYen).toBe(300)
    const t2 = calcTotals([item(100, 10, 1.1)], 'floor') // 110円
    expect(t2.subtotalYen).toBe(110)
  })
  it('明細が空なら0円', () => {
    const t = calcTotals([], 'floor')
    expect(t.totalYen).toBe(0)
    expect(t.byRate).toEqual([])
  })
})

describe('parseNumber', () => {
  it('全角数字・カンマを受け付ける', () => {
    expect(parseNumber('１,２３４')).toBe(1234)
    expect(parseNumber('１２．５')).toBe(12.5)
    expect(parseNumber('－５００')).toBe(-500)
  })
  it('不正な文字列はnull', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1e5')).toBeNull()
  })
})

describe('登録番号', () => {
  it('形式が正しいものを受け付ける', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('t-1234567890123')).toBe(true)
    expect(normalizeRegistrationNumber('t1234567890123')).toBe('T1234567890123')
  })
  it('桁数違い・Tなしは不正', () => {
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('')).toBe(false)
  })
})

describe('formatYen', () => {
  it('桁区切りと負数', () => {
    expect(formatYen(1234567)).toBe('1,234,567円')
    expect(formatYen(-500)).toBe('-500円')
  })
})
