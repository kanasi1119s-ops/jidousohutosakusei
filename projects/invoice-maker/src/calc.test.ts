import { describe, expect, it } from 'vitest'
import {
  computeInvoice,
  divRound,
  formatYen,
  isValidRegistrationNumber,
  lineAmount,
  normalizeRegistrationNumber,
  parseNumberLoose,
  validateItems,
  withholdingTax,
} from './calc'
import type { LineItem } from './calc'

const item = (name: string, qty: number, unitPrice: number, taxRate: 10 | 8 | 0 = 10): LineItem => ({ name, qty, unitPrice, taxRate })

describe('parseNumberLoose', () => {
  it('全角数字・カンマ・空白を扱える', () => {
    expect(parseNumberLoose('１，２３４')).toBe(1234)
    expect(parseNumberLoose(' 12.5 ')).toBe(12.5)
    expect(parseNumberLoose('−５００')).toBe(-500)
  })
  it('不正な文字列は NaN', () => {
    expect(parseNumberLoose('')).toBeNaN()
    expect(parseNumberLoose('abc')).toBeNaN()
    expect(parseNumberLoose('1e5')).toBeNaN()
    expect(parseNumberLoose('1.2.3')).toBeNaN()
  })
})

describe('divRound', () => {
  it('切捨て・四捨五入・切上げ', () => {
    expect(divRound(105, 100, 'floor')).toBe(1)
    expect(divRound(150, 100, 'round')).toBe(2)
    expect(divRound(149, 100, 'round')).toBe(1)
    expect(divRound(101, 100, 'ceil')).toBe(2)
  })
  it('負数は0方向に丸める（符号対称）', () => {
    expect(divRound(-105, 100, 'floor')).toBe(-1)
    expect(divRound(-101, 100, 'ceil')).toBe(-2)
  })
})

describe('computeInvoice', () => {
  it('10%の単純ケース', () => {
    const t = computeInvoice([item('制作', 1, 100000)], 'floor', false)
    expect(t.subtotal).toBe(100000)
    expect(t.tax).toBe(10000)
    expect(t.total).toBe(110000)
  })
  it('税率ごとに1回だけ端数処理する（行ごとではない）', () => {
    // 1円×3行: 行ごと切捨てなら税0、税率ごと合計3円×10%=0.3 → 0
    // 15円×3行: 合計45円×10%=4.5 → 切捨て4
    const t = computeInvoice([item('a', 1, 15), item('b', 1, 15), item('c', 1, 15)], 'floor', false)
    expect(t.groups).toEqual([{ rate: 10, subtotal: 45, tax: 4 }])
    expect(computeInvoice([item('a', 1, 15), item('b', 1, 15), item('c', 1, 15)], 'round', false).tax).toBe(5)
    expect(computeInvoice([item('a', 1, 15), item('b', 1, 15), item('c', 1, 15)], 'ceil', false).tax).toBe(5)
  })
  it('10%と8%と非課税を税率別に集計', () => {
    const t = computeInvoice([item('a', 2, 1000, 10), item('b', 3, 500, 8), item('c', 1, 300, 0)], 'floor', false)
    expect(t.groups).toEqual([
      { rate: 10, subtotal: 2000, tax: 200 },
      { rate: 8, subtotal: 1500, tax: 120 },
      { rate: 0, subtotal: 300, tax: 0 },
    ])
    expect(t.total).toBe(2000 + 200 + 1500 + 120 + 300)
  })
  it('小数数量の行金額（浮動小数点誤差なし）', () => {
    expect(lineAmount(item('a', 1.1, 100), 'floor')).toBe(110)
    expect(lineAmount(item('a', 0.3, 1000), 'floor')).toBe(300)
    expect(lineAmount(item('a', 2.5, 333), 'floor')).toBe(832)
    expect(lineAmount(item('a', 2.5, 333), 'round')).toBe(833)
  })
  it('値引き（負の単価）を扱える', () => {
    const t = computeInvoice([item('a', 1, 10000), item('値引き', 1, -1000)], 'floor', false)
    expect(t.subtotal).toBe(9000)
    expect(t.tax).toBe(900)
  })
  it('源泉徴収は税抜金額に対して計算し請求金額から差し引く', () => {
    const t = computeInvoice([item('a', 1, 100000)], 'floor', true)
    expect(t.withholding).toBe(10210)
    expect(t.total).toBe(110000 - 10210)
  })
})

describe('withholdingTax', () => {
  it('100万円以下は10.21%', () => {
    expect(withholdingTax(1_000_000)).toBe(102100)
    expect(withholdingTax(12345)).toBe(1260) // 1260.4245 切捨て
  })
  it('100万円超は超過分20.42%', () => {
    expect(withholdingTax(2_000_000)).toBe(102100 + 204200)
  })
  it('0以下は0', () => {
    expect(withholdingTax(0)).toBe(0)
    expect(withholdingTax(-5)).toBe(0)
  })
})

describe('validateItems / 登録番号 / 表示', () => {
  it('不正な明細を検出', () => {
    expect(validateItems([])).toHaveLength(1)
    expect(validateItems([item('', 1, 100)])).toHaveLength(1)
    expect(validateItems([item('a', NaN, 100)])).toHaveLength(1)
    expect(validateItems([item('a', 1, 10.5)])).toHaveLength(1)
    expect(validateItems([item('a', 10000, 100)])).toHaveLength(1)
    expect(validateItems([item('a', 1.0001, 100)])).toHaveLength(1)
    expect(validateItems([item('a', 1, 100_000_000)])).toHaveLength(1)
    expect(validateItems([item('a', 1.5, 100)])).toHaveLength(0)
  })
  it('極端に大きい合計は検証で拒否され、許容上限では安全整数に収まる', () => {
    const huge = Array.from({ length: 100 }, () => item('a', 9999, 99_999_999))
    expect(validateItems(huge).some((i) => i.message.includes('税抜合計'))).toBe(true)
    const maxOk = [item('a', 1, 99_999_999), ...Array.from({ length: 99 }, () => item('b', 1, 99_999_999))]
    expect(validateItems(maxOk)).toHaveLength(0)
    const t = computeInvoice(maxOk, 'floor', true)
    expect(Number.isSafeInteger(t.total)).toBe(true)
    expect(Number.isSafeInteger(t.subtotal * 2042)).toBe(true)
  })
  it('登録番号の検証と正規化', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(normalizeRegistrationNumber('ｔ１２３４５６７８９０１２３')).toBe('T1234567890123')
    expect(normalizeRegistrationNumber(' T-1234 5678-90123 ')).toBe('T1234567890123')
  })
  it('金額表示', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatYen(-1000)).toBe('¥-1,000'.replace('¥-', '-¥'))
    expect(formatYen(0)).toBe('¥0')
  })
})
