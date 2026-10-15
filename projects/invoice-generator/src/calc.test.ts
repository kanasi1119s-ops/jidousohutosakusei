import { describe, it, expect } from 'vitest'
import { calcTotals, parseNumber, applyRounding, isValidRegistrationNumber } from './calc'
import { emptyInvoice, validateInvoice, parseInvoiceJson } from './invoice'
import { buildInvoiceCsv, downloadName } from './csv'

describe('parseNumber', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(parseNumber('¥1,500円')).toBe(1500)
    expect(parseNumber('１．５')).toBe(1.5)
  })
  it('不正な入力は NaN', () => {
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1e5')).toBeNaN()
  })
})

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    // 10%対象: 105 + 105 = 210 → 税21。行ごとに処理すると 10+10=20 になる(切り捨て)
    const t = calcTotals(
      [
        { name: 'a', quantity: 1, unitPrice: 105, taxRate: 10 },
        { name: 'b', quantity: 1, unitPrice: 105, taxRate: 10 },
      ],
      'floor',
    )
    expect(t.byRate).toEqual([{ taxRate: 10, subtotal: 210, tax: 21 }])
    expect(t.total).toBe(231)
  })
  it('複数税率を区分する', () => {
    const t = calcTotals(
      [
        { name: 'a', quantity: 2, unitPrice: 1000, taxRate: 10 },
        { name: 'b', quantity: 1, unitPrice: 999, taxRate: 8 },
      ],
      'floor',
    )
    expect(t.byRate.map((r) => r.tax)).toEqual([200, 79])
    expect(t.total).toBe(2000 + 200 + 999 + 79)
  })
  it('端数処理モード', () => {
    expect(applyRounding(10.5, 'floor')).toBe(10)
    expect(applyRounding(10.5, 'round')).toBe(11)
    expect(applyRounding(10.1, 'ceil')).toBe(11)
    expect(applyRounding(110.00000000000001, 'ceil')).toBe(110)
  })
  it('小数の数量を円に丸める', () => {
    expect(calcTotals([{ name: 'a', quantity: 1.5, unitPrice: 333, taxRate: 10 }], 'floor').lineAmounts[0]).toBe(500)
  })
  it('数量・単価がNaNの行は0円扱いでNaNを出さない（Round2で発見）', () => {
    const t = calcTotals([{ name: 'a', quantity: NaN, unitPrice: 100, taxRate: 10 }], 'floor')
    expect(t.total).toBe(0)
  })
  it('明細が空でも落ちない', () => {
    expect(calcTotals([], 'floor').total).toBe(0)
  })
})

describe('validate / import', () => {
  it('登録番号の形式', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T123')).toBe(false)
  })
  it('空の請求書は不足項目を指摘する', () => {
    expect(validateInvoice(emptyInvoice('2026-10-15')).length).toBeGreaterThan(2)
  })
  it('不正なJSONはエラー', () => {
    expect(() => parseInvoiceJson('{')).toThrow()
    expect(() => parseInvoiceJson('{"items":[{"name":1}]}')).toThrow()
  })
  it('BOM付きJSONを読み込める', () => {
    const inv = { ...emptyInvoice('2026-10-15'), clientName: '株式会社テスト' }
    const out = parseInvoiceJson('﻿' + JSON.stringify([inv]))
    expect(out[0].clientName).toBe('株式会社テスト')
  })
})

describe('csv', () => {
  it('BOM付きで日本語ヘッダーを含み、式インジェクションを無効化する', () => {
    const inv = emptyInvoice('2026-10-15')
    inv.items[0].name = '=HYPERLINK("x")'
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv).toContain("'=HYPERLINK")
  })
  it('ダウンロード名は英数字のみ', () => {
    expect(downloadName('invoice', 'csv', new Date(2026, 9, 5))).toBe('invoice-2026-10-05.csv')
  })
})
