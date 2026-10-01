import { describe, expect, it } from 'vitest'
import {
  applyRounding,
  calcTotals,
  formatDateJa,
  formatYen,
  isValidRegistrationNumber,
  normalizeNumber,
  normalizeRegistrationNumber,
  type Item,
} from './calc'

const item = (unitPrice: number, quantity = 1, taxRate: 10 | 8 | 0 = 10): Item => ({
  name: 'x',
  quantity,
  unitPrice,
  taxRate,
})

describe('normalizeNumber', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(normalizeNumber('１，２３４')).toBe(1234)
    expect(normalizeNumber('¥5,000円')).toBe(5000)
    expect(normalizeNumber('－３００')).toBe(-300)
    expect(normalizeNumber('１２．５')).toBe(12.5)
  })
  it('不正な入力は0', () => {
    expect(normalizeNumber('')).toBe(0)
    expect(normalizeNumber('abc')).toBe(0)
    expect(normalizeNumber('1e9999')).toBe(0)
  })
  it('巨大値は上限に丸める', () => {
    expect(normalizeNumber('99999999999999')).toBe(1_000_000_000)
  })
})

describe('applyRounding', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(applyRounding(10.5, 'floor')).toBe(10)
    expect(applyRounding(10.5, 'round')).toBe(11)
    expect(applyRounding(10.1, 'ceil')).toBe(11)
  })
  it('負数は絶対値で処理し符号を戻す', () => {
    expect(applyRounding(-10.5, 'floor')).toBe(-10)
    expect(applyRounding(-0.2, 'floor')).toBe(0)
  })
})

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する（行ごとの端数処理とは結果が異なる）', () => {
    // 各行 税抜 15円 → 行ごとに切り捨てると税1円×10行=10円、請求書単位なら 150*10% = 15円
    const items = Array.from({ length: 10 }, () => item(15))
    const t = calcTotals(items, 'exclusive', 'floor')
    expect(t.groups).toHaveLength(1)
    expect(t.groups[0]).toMatchObject({ rate: 10, base: 150, tax: 15, total: 165 })
    expect(t.total).toBe(165)
  })
  it('10%と8%を分けて集計する', () => {
    const t = calcTotals([item(1000), item(500, 2, 8)], 'exclusive', 'floor')
    expect(t.groups.map((g) => [g.rate, g.base, g.tax])).toEqual([
      [10, 1000, 100],
      [8, 1000, 80],
    ])
    expect(t.subtotal).toBe(2000)
    expect(t.tax).toBe(180)
    expect(t.total).toBe(2180)
  })
  it('税込入力: 税込合計から税額を内税計算する', () => {
    const t = calcTotals([item(1100)], 'inclusive', 'floor')
    expect(t.groups[0]).toMatchObject({ base: 1000, tax: 100, total: 1100 })
    const t2 = calcTotals([item(1000, 1, 8)], 'inclusive', 'floor')
    // 1000*8/108 = 74.07 → 切り捨て 74
    expect(t2.groups[0]).toMatchObject({ base: 926, tax: 74, total: 1000 })
  })
  it('端数処理の方式で税額が変わる', () => {
    const items = [item(105)] // 10.5円
    expect(calcTotals(items, 'exclusive', 'floor').tax).toBe(10)
    expect(calcTotals(items, 'exclusive', 'round').tax).toBe(11)
    expect(calcTotals(items, 'exclusive', 'ceil').tax).toBe(11)
  })
  it('非課税は税額0', () => {
    const t = calcTotals([item(3000, 1, 0)], 'exclusive', 'floor')
    expect(t.groups[0]).toMatchObject({ rate: 0, tax: 0, total: 3000 })
  })
  it('値引き行（負数）を含められる', () => {
    const t = calcTotals([item(1000), item(-200)], 'exclusive', 'floor')
    expect(t.total).toBe(880)
  })
  it('空の明細は0円', () => {
    const t = calcTotals([], 'exclusive', 'floor')
    expect(t.total).toBe(0)
    expect(t.groups).toEqual([])
  })
  it('小数の数量は行金額を円単位に丸める', () => {
    const t = calcTotals([item(1000, 1.5)], 'exclusive', 'floor')
    expect(t.lineAmounts[0]).toBe(1500)
    const t2 = calcTotals([item(333, 0.5)], 'exclusive', 'floor')
    expect(t2.lineAmounts[0]).toBe(166)
  })
})

describe('登録番号', () => {
  it('T+13桁を正しいとみなし、全角・ハイフン・小文字を正規化する', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('ｔ１２３４-５６７８-９０１２３')).toBe(true)
    expect(normalizeRegistrationNumber(' t1234567890123 ')).toBe('T1234567890123')
  })
  it('桁数違い・Tなしは不正', () => {
    expect(isValidRegistrationNumber('')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
  })
})

describe('表示整形', () => {
  it('金額と日付', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatYen(-500)).toBe('-¥500')
    expect(formatDateJa('2026-10-01')).toBe('2026年10月1日')
    expect(formatDateJa('')).toBe('')
  })
})
