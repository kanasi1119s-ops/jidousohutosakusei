import { describe, expect, it } from 'vitest'
import { applyRounding, calcInvoice, isValidRegistrationNo, newInvoice, parseNumber, validateInvoice } from './invoice'
import { buildInvoiceCsv, safeFileName } from './csv'
import { buildExportJson, parseStore, sanitizeInvoice } from './storage'

describe('parseNumber', () => {
  it('全角数字・カンマを正規化する', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(parseNumber('１２．５')).toBe(12.5)
    expect(parseNumber('')).toBe(0)
  })
  it('不正な入力は NaN', () => {
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1e5')).toBeNaN()
  })
})

describe('calcInvoice', () => {
  it('税率ごとに1回だけ端数処理する（切り捨て）', () => {
    // 333円×3行(10%) = 999 -> 税 99.9 -> 99。行ごとに処理すると 33*3=99 で同じだが、
    // 105円×3行: 行ごと切り捨てだと 10*3=30、合計 315 -> 31.5 -> 31
    const items = [1, 2, 3].map(() => ({ name: 'x', qty: 1, unitPrice: 105, rate: 10 as const }))
    const t = calcInvoice(items, 'floor')
    expect(t.byRate).toEqual([{ rate: 10, subtotal: 315, tax: 31 }])
    expect(t.total).toBe(346)
  })
  it('10%と8%を区分して合計する', () => {
    const t = calcInvoice(
      [
        { name: 'a', qty: 1, unitPrice: 1000, rate: 10 },
        { name: 'b', qty: 2, unitPrice: 500, rate: 8 },
      ],
      'floor',
    )
    expect(t.byRate).toEqual([
      { rate: 10, subtotal: 1000, tax: 100 },
      { rate: 8, subtotal: 1000, tax: 80 },
    ])
    expect(t.total).toBe(2180)
  })
  it('端数処理の方式で結果が変わる', () => {
    const items = [{ name: 'a', qty: 1, unitPrice: 105, rate: 10 as const }]
    expect(calcInvoice(items, 'floor').tax).toBe(10)
    expect(calcInvoice(items, 'round').tax).toBe(11)
    expect(calcInvoice(items, 'ceil').tax).toBe(11)
  })
  it('小数数量でも浮動小数点誤差が出ない', () => {
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
    const t = calcInvoice([{ name: 'a', qty: 0.1, unitPrice: 30, rate: 10 }], 'floor')
    expect(t.lineAmounts[0]).toBe(3)
  })
  it('数値でない入力(NaN)は0円として扱い、NaNを表示しない', () => {
    const t = calcInvoice([{ name: 'a', qty: NaN, unitPrice: 100, rate: 10 }], 'floor')
    expect(t.total).toBe(0)
  })
  it('明細なしは0', () => {
    expect(calcInvoice([], 'floor').total).toBe(0)
  })
})

describe('validate', () => {
  it('登録番号の形式', () => {
    expect(isValidRegistrationNo('T1234567890123')).toBe(true)
    expect(isValidRegistrationNo('T123')).toBe(false)
    expect(isValidRegistrationNo('1234567890123')).toBe(false)
  })
  it('未入力を警告する', () => {
    const w = validateInvoice(newInvoice())
    expect(w.some((m) => m.includes('登録番号'))).toBe(true)
    expect(w.some((m) => m.includes('請求先'))).toBe(true)
  })
})

describe('csv', () => {
  it('BOM付きUTF-8で日本語を含む', () => {
    const inv = newInvoice()
    inv.customerName = '株式会社テスト'
    inv.items[0] = { name: '設計費', qty: 1, unitPrice: 1000, rate: 10 }
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('株式会社テスト')
    expect(csv).toContain('設計費')
  })
  it('数式として解釈される先頭文字を無効化する', () => {
    const inv = newInvoice()
    inv.items[0] = { name: '=HYPERLINK("x")', qty: 1, unitPrice: 1, rate: 10 }
    expect(buildInvoiceCsv(inv)).toContain("'=HYPERLINK")
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('請求書-2026/01', 'csv')).toBe('-202601.csv')
    expect(safeFileName('請求書', 'csv')).toBe('invoice.csv')
  })
})

describe('storage', () => {
  it('エクスポート→インポートの往復', () => {
    const inv = newInvoice()
    inv.customerName = '山田商店'
    const json = buildExportJson({ invoices: [inv], current: null, lastIssuer: inv.issuer })
    const back = parseStore('﻿' + json)
    expect(back?.invoices[0].customerName).toBe('山田商店')
  })
  it('不正データは拒否・正規化される', () => {
    expect(parseStore('not json')).toBeNull()
    expect(parseStore('{"invoices":"x"}')).toBeNull()
    expect(sanitizeInvoice({ items: 'x' })).toBeNull()
    const s = sanitizeInvoice({ items: [{ name: 5, qty: 'a', unitPrice: Infinity, rate: 3 }], id: '<script>' })!
    expect(s.items[0]).toEqual({ name: '', qty: 0, unitPrice: 0, rate: 10 })
    expect(s.id).not.toBe('<script>')
  })
})
