import { describe, expect, it } from 'vitest'
import {
  calculateInvoice, divRound, isValidRegistrationNumber, normalizeNumericText,
  normalizeRegistrationNumber, parseNumberLoose, validateInvoice, type InvoiceInput, type IssuerInfo,
} from './calc'
import { buildInvoiceCsv, safeFileName, stripBom } from './csv'
import { defaultState, parseStateFromJsonText, stateToJson } from './storage'

const base = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  invoiceNumber: 'A-1', issueDate: '2026-11-21', dueDate: '', customerName: '株式会社テスト',
  priceMode: 'excl', rounding: 'floor', note: '',
  items: [{ name: '制作費', quantity: 1, unitPriceYen: 1000, taxRate: 10 }], ...over,
})
const issuer: IssuerInfo = { name: '山田太郎', postalAddress: '', registrationNumber: 'T1234567890123', contact: '', bankInfo: '' }

describe('divRound', () => {
  it('切り捨て・四捨五入・切り上げ', () => {
    expect(divRound(105, 100, 'floor')).toBe(1)
    expect(divRound(150, 100, 'round')).toBe(2)
    expect(divRound(149, 100, 'round')).toBe(1)
    expect(divRound(101, 100, 'ceil')).toBe(2)
    expect(divRound(100, 100, 'ceil')).toBe(1)
  })
})

describe('calculateInvoice', () => {
  it('税抜入力: 税率ごとに1回だけ端数処理する', () => {
    // 3行×333円=999円(10%) → 税額 99.9 → 切り捨て99。行ごとに処理すると 33*3=99 で同じだが、
    // 3行×105円=315 → 31.5 → 切り捨て31（行ごとなら10*3=30になる）
    const r = calculateInvoice(base({ items: [105, 105, 105].map((p) => ({ name: 'x', quantity: 1, unitPriceYen: p, taxRate: 10 as const })) }))
    expect(r.summaries).toEqual([{ rate: 10, baseYen: 315, taxYen: 31, grossYen: 346 }])
    expect(r.totalYen).toBe(346)
  })
  it('10%と8%を区分して集計する', () => {
    const r = calculateInvoice(base({ items: [
      { name: 'a', quantity: 2, unitPriceYen: 1000, taxRate: 10 },
      { name: 'b', quantity: 1, unitPriceYen: 500, taxRate: 8 },
    ] }))
    expect(r.summaries.map((s) => [s.rate, s.baseYen, s.taxYen])).toEqual([[10, 2000, 200], [8, 500, 40]])
    expect(r.totalYen).toBe(2740)
  })
  it('税込入力: 税込合計から税額を逆算する', () => {
    const r = calculateInvoice(base({ priceMode: 'incl', items: [{ name: 'a', quantity: 1, unitPriceYen: 1100, taxRate: 10 }] }))
    expect(r.summaries[0]).toEqual({ rate: 10, baseYen: 1000, taxYen: 100, grossYen: 1100 })
    const r2 = calculateInvoice(base({ priceMode: 'incl', items: [{ name: 'a', quantity: 1, unitPriceYen: 1000, taxRate: 10 }] }))
    expect(r2.summaries[0].taxYen).toBe(90) // 90.909... 切り捨て
    expect(r2.totalYen).toBe(1000)
  })
  it('小数の数量でも浮動小数点誤差が出ない', () => {
    const r = calculateInvoice(base({ items: [{ name: 'a', quantity: 0.1, unitPriceYen: 30, taxRate: 10 }] }))
    expect(r.lineAmounts[0]).toBe(3)
  })
  it('四捨五入設定', () => {
    const r = calculateInvoice(base({ rounding: 'round', items: [{ name: 'a', quantity: 1, unitPriceYen: 105, taxRate: 10 }] }))
    expect(r.summaries[0].taxYen).toBe(11) // 10.5 → 11
  })
})

describe('入力の正規化', () => {
  it('全角数字・カンマ', () => {
    expect(normalizeNumericText('１，２３４．５')).toBe('1234.5')
    expect(parseNumberLoose('１２００')).toBe(1200)
    expect(parseNumberLoose('abc')).toBeNaN()
    expect(parseNumberLoose('')).toBeNaN()
  })
  it('登録番号', () => {
    expect(normalizeRegistrationNumber('ｔ１２３４－５６７８９０１２３')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('validateInvoice', () => {
  it('正常系はエラーなし', () => expect(validateInvoice(issuer, base())).toEqual([]))
  it('必須項目と不正値', () => {
    const e = validateInvoice({ ...issuer, name: '', registrationNumber: 'bad' }, base({ customerName: '', items: [{ name: '', quantity: NaN, unitPriceYen: -1, taxRate: 10 }] }))
    expect(e.length).toBeGreaterThanOrEqual(5)
  })
})

describe('CSV', () => {
  it('BOM付きで日本語ヘッダー、数式インジェクションを無効化', () => {
    const inv = base({ items: [{ name: '=cmd', quantity: 1, unitPriceYen: 1, taxRate: 10 }] })
    const csv = buildInvoiceCsv(inv, calculateInvoice(inv))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量')
    expect(csv).toContain("'=cmd")
    expect(stripBom(csv).charCodeAt(0)).not.toBe(0xfeff)
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('請求書', 'csv', new Date(2026, 10, 21))).toBe('invoice-2026-11-21.csv')
  })
})

describe('JSON往復', () => {
  it('エクスポート→インポートで一致', () => {
    const s = defaultState()
    s.issuer.name = '日本語の名前'
    expect(parseStateFromJsonText('﻿' + stateToJson(s)).issuer.name).toBe('日本語の名前')
  })
  it('不正なJSON/形式はエラー', () => {
    expect(() => parseStateFromJsonText('{')).toThrow()
    expect(() => parseStateFromJsonText('{"a":1}')).toThrow()
  })
})
