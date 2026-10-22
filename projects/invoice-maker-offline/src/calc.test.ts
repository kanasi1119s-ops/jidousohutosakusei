import { describe, expect, it } from 'vitest'
import { calcLineAmount, calcWithholding, computeInvoice, formatMilli, normalizeNumberText, parseMilli, roundDiv } from './calc'
import type { LineInput } from './calc'

const item = (unitPrice: string, taxRate: 10 | 8 | 0 = 10, quantity = '1', description = '品名'): LineInput => ({
  description,
  quantity,
  unitPrice,
  taxRate,
})

describe('数値の解釈', () => {
  it('全角数字・カンマ・全角ピリオドを正規化する', () => {
    expect(normalizeNumberText('１，２３４．５')).toBe('1234.5')
    expect(parseMilli('１,２３４.５')).toBe(1234500n)
  })
  it('不正な文字列と小数4桁は null', () => {
    expect(parseMilli('abc')).toBeNull()
    expect(parseMilli('1.2345')).toBeNull()
    expect(parseMilli('')).toBeNull()
  })
  it('負の値を扱える', () => {
    expect(parseMilli('-500')).toBe(-500000n)
    expect(formatMilli(-1500500n)).toBe('-1,500.5')
  })
})

describe('端数処理', () => {
  it('正の値の切捨て・四捨五入・切上げ', () => {
    expect(roundDiv(25n, 10n, 'floor')).toBe(2n)
    expect(roundDiv(25n, 10n, 'round')).toBe(3n)
    expect(roundDiv(21n, 10n, 'ceil')).toBe(3n)
  })
  it('負の値は絶対値に対して処理する', () => {
    expect(roundDiv(-25n, 10n, 'floor')).toBe(-2n)
    expect(roundDiv(-25n, 10n, 'round')).toBe(-3n)
  })
})

describe('明細金額', () => {
  it('小数の数量を扱う', () => {
    expect(calcLineAmount('1.5', '1000', 'floor')).toEqual({ status: 'ok', amount: 1500 })
    expect(calcLineAmount('0.333', '100', 'floor')).toEqual({ status: 'ok', amount: 33 })
  })
  it('巨大な値はエラーにする', () => {
    expect(calcLineAmount('1000000', '1000000000', 'floor').status).toBe('error')
  })
  it('不正な値はエラーにする', () => {
    expect(calcLineAmount('x', '100', 'floor').status).toBe('error')
    expect(calcLineAmount('1', 'x', 'floor').status).toBe('error')
  })
})

describe('請求書計算', () => {
  it('税額は税率ごとに合計してから1回だけ端数処理する', () => {
    // 行ごとに処理すると 33+33+33=99 だが、合計999円に対して10%=99.9→切捨て99、四捨五入なら100
    const r = computeInvoice([item('333'), item('333'), item('333')], 'round', false)
    expect(r.byRate).toEqual([{ rate: 10, subtotal: 999, tax: 100 }])
    expect(r.total).toBe(1099)
  })
  it('10%・8%・非課税を区分する', () => {
    const r = computeInvoice([item('1000', 10), item('500', 8), item('300', 0)], 'floor', false)
    expect(r.byRate).toEqual([
      { rate: 10, subtotal: 1000, tax: 100 },
      { rate: 8, subtotal: 500, tax: 40 },
      { rate: 0, subtotal: 300, tax: 0 },
    ])
    expect(r.subtotal).toBe(1800)
    expect(r.tax).toBe(140)
    expect(r.total).toBe(1940)
  })
  it('空行は無視し、エラー行を報告する', () => {
    const r = computeInvoice([item('', 10, '1', ''), item('abc')], 'floor', false)
    expect(r.lines[0]).toEqual({ status: 'empty' })
    expect(r.errors[0]).toContain('2行目')
  })
  it('値引き（負の単価）を扱える', () => {
    const r = computeInvoice([item('10000'), item('-1000')], 'floor', false)
    expect(r.subtotal).toBe(9000)
    expect(r.tax).toBe(900)
  })
  it('全角入力でも同じ結果になる', () => {
    const r = computeInvoice([item('１，０００', 10, '２')], 'floor', false)
    expect(r.subtotal).toBe(2000)
  })
})

describe('源泉徴収', () => {
  it('100万円以下は10.21%（1円未満切捨て）', () => {
    expect(calcWithholding(100000)).toBe(10210)
    expect(calcWithholding(12345)).toBe(1260)
  })
  it('100万円超の部分は20.42%', () => {
    expect(calcWithholding(1_000_000)).toBe(102100)
    expect(calcWithholding(2_000_000)).toBe(102100 + 204200)
  })
  it('0以下は0', () => {
    expect(calcWithholding(0)).toBe(0)
    expect(calcWithholding(-100)).toBe(0)
  })
  it('有効時は差引請求額に反映される', () => {
    const r = computeInvoice([item('100000')], 'floor', true)
    expect(r.withholding).toBe(10210)
    expect(r.payable).toBe(110000 - 10210)
  })
})
