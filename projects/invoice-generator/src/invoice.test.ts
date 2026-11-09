import { describe, it, expect } from 'vitest'
import { roundDiv, calculate, parseNumber, validateInvoice, isValidRegistrationNumber, normalizeRegistrationNumber, isValidDate, type Item } from './invoice'

const item = (unitPrice: number, rate: 10 | 8 = 10, quantity = 1): Item => ({ name: 'x', quantity, unit: '個', unitPrice, rate })

describe('roundDiv', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(roundDiv(10, 3, 'floor')).toBe(3)
    expect(roundDiv(10, 3, 'ceil')).toBe(4)
    expect(roundDiv(5, 2, 'round')).toBe(3)
    expect(roundDiv(4, 3, 'round')).toBe(1)
    expect(roundDiv(6, 3, 'ceil')).toBe(2)
  })
  it('負数は絶対値に対して処理する', () => {
    expect(roundDiv(-10, 3, 'floor')).toBe(-3)
    expect(roundDiv(-10, 3, 'ceil')).toBe(-4)
    expect(Object.is(roundDiv(-1, 3, 'floor'), 0)).toBe(true)
  })
})

describe('calculate', () => {
  it('税率ごとに1回だけ端数処理する（明細ごとではない）', () => {
    // 税抜 33円×3行 = 99円。10%: 9.9 → 切り捨て 9円（明細ごとだと 3×3=9で同じ）。差が出る例:
    const items = [item(15), item(15), item(15)] // 合計45 → 4.5 → 切り捨て4。明細ごと(1.5→1)×3=3
    const c = calculate(items, 'exclusive', 'floor')
    expect(c.byRate).toEqual([{ rate: 10, base: 45, tax: 4, gross: 49 }])
  })
  it('10%と8%を分けて集計する', () => {
    const c = calculate([item(1000, 10), item(500, 8, 3)], 'exclusive', 'floor')
    expect(c.byRate).toEqual([
      { rate: 10, base: 1000, tax: 100, gross: 1100 },
      { rate: 8, base: 1500, tax: 120, gross: 1620 },
    ])
    expect(c.gross).toBe(2720)
    expect(c.tax).toBe(220)
  })
  it('税込入力: 内税額を税率ごとに算出', () => {
    const c = calculate([item(1100, 10), item(108, 8)], 'inclusive', 'floor')
    expect(c.byRate[0]).toEqual({ rate: 10, base: 1000, tax: 100, gross: 1100 })
    expect(c.byRate[1]).toEqual({ rate: 8, base: 100, tax: 8, gross: 108 })
  })
  it('数量が小数でも誤差なく計算（0.1×3 等）', () => {
    const c = calculate([item(1000, 10, 0.1)], 'exclusive', 'floor')
    expect(c.lineAmounts[0]).toBe(100)
    expect(calculate([item(100, 10, 1.005)], 'exclusive', 'round').lineAmounts[0]).toBe(101)
  })
  it('値引き行（負の単価）を扱える', () => {
    const c = calculate([item(1000), item(-200)], 'exclusive', 'floor')
    expect(c.base).toBe(800)
    expect(c.tax).toBe(80)
  })
  it('明細なしは0', () => {
    expect(calculate([], 'exclusive', 'floor').gross).toBe(0)
  })
})

describe('parseNumber', () => {
  it('全角数字・カンマ・全角マイナスを受け付ける', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(parseNumber('－５００')).toBe(-500)
    expect(parseNumber('1.5')).toBe(1.5)
    expect(parseNumber(' 2 000 ')).toBe(2000)
  })
  it('不正な値は NaN', () => {
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1e3')).toBeNaN()
  })
})

describe('登録番号・日付', () => {
  it('形式検証と正規化', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(normalizeRegistrationNumber(' ｔ１２３４-５６７８９０１２３ ')).toBe('T1234567890123')
  })
  it('実在しない日付は不正', () => {
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2026-11-09')).toBe(true)
    expect(isValidDate('2026/11/09')).toBe(false)
  })
})

describe('validateInvoice', () => {
  const base = {
    number: 'INV-1', issueDate: '2026-11-09', dueDate: '', customerName: '株式会社テスト',
    issuer: { name: '山田太郎', registrationNumber: 'T1234567890123', address: '', contact: '', bank: '' },
    items: [item(1000)],
  }
  it('正常', () => {
    expect(validateInvoice(base)).toEqual({ errors: [], warnings: [] })
  })
  it('登録番号なしは警告、形式不正はエラー', () => {
    expect(validateInvoice({ ...base, issuer: { ...base.issuer, registrationNumber: '' } }).warnings).toHaveLength(1)
    expect(validateInvoice({ ...base, issuer: { ...base.issuer, registrationNumber: 'T12' } }).errors).toHaveLength(1)
  })
  it('必須項目の欠落を検出', () => {
    const r = validateInvoice({ ...base, customerName: '', items: [] })
    expect(r.errors.length).toBe(2)
  })
  it('数量0・NaN単価・小数4桁以上を検出', () => {
    const r = validateInvoice({ ...base, items: [{ ...item(NaN), name: 'a' }, { ...item(10, 10, 0), name: 'b' }, { ...item(10, 10, 1.2345), name: 'c' }] })
    expect(r.errors.length).toBe(3)
  })
})
