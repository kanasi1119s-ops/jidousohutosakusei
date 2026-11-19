import { describe, expect, it } from 'vitest'
import { calculate, divideRounded, isInRange, isValidRegistrationNumber, normalizeRegistrationNumber, parseNumber, type Item } from './calc'
import { buildInvoiceCsv } from './csv'
import { defaultInvoice, parseInvoice, safeFileStem, validateInvoice } from './model'
import { parseInvoiceJsonText } from './storage'

const item = (unitPrice: number, taxRate: 10 | 8 | 0 = 10, quantity = 1): Item => ({
  name: 'x',
  quantity,
  unit: '個',
  unitPrice,
  taxRate,
})

describe('divideRounded', () => {
  it('floor/round/ceil', () => {
    expect(divideRounded(315, 10, 'floor')).toBe(31)
    expect(divideRounded(315, 10, 'round')).toBe(32)
    expect(divideRounded(315, 10, 'ceil')).toBe(32)
    expect(divideRounded(310, 10, 'ceil')).toBe(31)
  })
  it('負数は絶対値で処理して符号を戻す', () => {
    expect(divideRounded(-105, 10, 'floor')).toBe(-10)
    expect(divideRounded(-105, 10, 'round')).toBe(-11)
  })
  it('0 は -0 にならない', () => {
    expect(Object.is(divideRounded(0, 10, 'floor'), 0)).toBe(true)
  })
})

describe('calculate', () => {
  it('税抜: 税率ごとに集計して消費税額を計算する', () => {
    const t = calculate([item(1000, 10, 3), item(500, 8)], 'exclusive', 'floor')
    expect(t.groups).toEqual([
      { rate: 10, amount: 3000, tax: 300 },
      { rate: 8, amount: 500, tax: 40 },
    ])
    expect(t.grandTotal).toBe(3840)
    expect(t.totalTax).toBe(340)
  })
  it('消費税額の端数処理は明細ごとではなく税率ごとに1回', () => {
    const items = [item(105), item(105), item(105)]
    expect(calculate(items, 'exclusive', 'floor').groups[0].tax).toBe(31) // 明細ごとなら30
    expect(calculate(items, 'exclusive', 'round').groups[0].tax).toBe(32)
  })
  it('税込: 内税額を計算し合計は税込合計', () => {
    const t = calculate([item(1000)], 'inclusive', 'floor')
    expect(t.groups[0]).toEqual({ rate: 10, amount: 1000, tax: 90 })
    expect(t.grandTotal).toBe(1000)
    expect(calculate([item(1000)], 'inclusive', 'round').groups[0].tax).toBe(91)
  })
  it('非課税は税額0', () => {
    const t = calculate([item(1234, 0)], 'exclusive', 'floor')
    expect(t.groups).toEqual([{ rate: 0, amount: 1234, tax: 0 }])
    expect(t.grandTotal).toBe(1234)
  })
  it('小数の数量', () => {
    expect(calculate([item(999, 10, 0.5)], 'exclusive', 'floor').lineAmounts[0]).toBe(499)
    expect(calculate([item(999, 10, 0.5)], 'exclusive', 'round').lineAmounts[0]).toBe(500)
  })
  it('値引き（負の明細）', () => {
    const t = calculate([item(10000), item(-1000)], 'exclusive', 'floor')
    expect(t.groups[0]).toEqual({ rate: 10, amount: 9000, tax: 900 })
  })
  it('明細なしでも落ちない', () => {
    const t = calculate([], 'exclusive', 'floor')
    expect(t.grandTotal).toBe(0)
    expect(t.groups).toEqual([])
  })
})

describe('範囲', () => {
  it('上限内/外の判定', () => {
    expect(isInRange(10000, 100_000_000)).toBe(true)
    expect(isInRange(10001, 1)).toBe(false)
    expect(isInRange(1, -100_000_001)).toBe(false)
  })
  it('上限ちょうどでも整数精度を保つ', () => {
    const t = calculate([item(100_000_000, 10, 10000)], 'exclusive', 'floor')
    expect(t.groups[0]).toEqual({ rate: 10, amount: 1_000_000_000_000, tax: 100_000_000_000 })
  })
  it('範囲外の JSON は取り込まない', () => {
    expect(() => parseInvoice({ schema: 1, items: [{ quantity: 1, unitPrice: 1e15, taxRate: 10 }] })).toThrow('範囲外')
  })
})

describe('parseNumber / 登録番号', () => {
  it('全角・カンマを受け付ける', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(parseNumber('－５')).toBe(-5)
    expect(parseNumber('1.5')).toBe(1.5)
  })
  it('不正は null', () => {
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('1e3')).toBeNull()
  })
  it('登録番号の正規化と検証', () => {
    expect(normalizeRegistrationNumber('ｔ１２３４-５６７８９０１２３')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('CSV', () => {
  it('先頭が BOM で日本語・カンマ・引用符を正しくエスケープする', () => {
    const inv = defaultInvoice()
    inv.items = [{ name: 'デザイン, "初稿"', quantity: 1, unit: '式', unitPrice: 1000, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"デザイン, ""初稿"""')
    expect(csv).toContain('1100')
  })
  it('数式として解釈される先頭記号を無効化する', () => {
    const inv = defaultInvoice()
    inv.items = [{ name: '=SUM(A1)', quantity: 1, unit: '式', unitPrice: 1, taxRate: 10 }]
    expect(buildInvoiceCsv(inv)).toContain("'=SUM(A1)")
  })
})

describe('model', () => {
  it('JSON の往復（BOM付きも可）', () => {
    const inv = defaultInvoice()
    inv.clientName = '株式会社テスト'
    const back = parseInvoiceJsonText('﻿' + JSON.stringify(inv))
    expect(back.clientName).toBe('株式会社テスト')
  })
  it('不正な JSON は日本語のエラー', () => {
    expect(() => parseInvoiceJsonText('{')).toThrow('JSON')
    expect(() => parseInvoice({ schema: 1, items: [{ quantity: 'a', unitPrice: 1, taxRate: 10 }] })).toThrow('数量')
    expect(() => parseInvoice({ schema: 1, items: [{ quantity: 1, unitPrice: 1, taxRate: 5 }] })).toThrow('税率')
    expect(() => parseInvoice(null)).toThrow()
    expect(() => parseInvoice({ schema: 2, items: [] })).toThrow('schema')
  })
  it('警告: 登録番号なし／形式不正', () => {
    const inv = defaultInvoice()
    expect(validateInvoice(inv).join()).toContain('登録番号が未入力')
    inv.issuer.registrationNumber = 'T12'
    expect(validateInvoice(inv).join()).toContain('形式が不正')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileStem('請求-001/A', '2026-11-19')).toBe('invoice--001A-2026-11-19')
    expect(safeFileStem('', '')).toBe('invoice')
  })
})
