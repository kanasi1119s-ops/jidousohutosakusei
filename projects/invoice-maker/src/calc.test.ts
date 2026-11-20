import { describe, expect, it } from 'vitest'
import { applyRounding, computeTotals, formatYen, isValidRegNoFormat, normalizeRegNo, parseNumber } from './calc'
import { buildInvoiceCsv, csvFileName, safeFileName } from './csv'
import { buildBackup, emptyInvoice, parseBackup, sanitizeInvoice, validateInvoice } from './model'

describe('parseNumber', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumber('１，２３４円')).toBe(1234)
    expect(parseNumber('￥1,000')).toBe(1000)
    expect(parseNumber('１２．５')).toBe(12.5)
    expect(parseNumber('-５')).toBe(-5)
  })
  it('不正な入力は NaN', () => {
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1e3')).toBeNaN()
    expect(parseNumber('99999999999999999999')).toBeNaN()
    expect(parseNumber('1000000000000')).toBe(1000000000000)
  })
})

describe('applyRounding', () => {
  it('浮動小数点誤差で切り上げが狂わない', () => {
    expect(applyRounding(1.1 * 100, 'ceil')).toBe(110)
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
  })
})

describe('computeTotals（税率ごとに1回だけ端数処理）', () => {
  it('明細ごとに丸めず、税率ごとの小計に対して1回だけ丸める', () => {
    // 各明細の税額は 10.5円。明細ごとに切り捨てると 10*3=30 だが、正しくは 315*0.1=31.5 → 31
    const items = [1, 2, 3].map(() => ({ description: 'x', quantity: 1, unitPriceYen: 105, taxRate: 10 as const }))
    const t = computeTotals(items, 'floor')
    expect(t.byRate).toEqual([{ rate: 10, subtotalYen: 315, taxYen: 31 }])
    expect(t.totalYen).toBe(346)
  })
  it('10%と8%が混在すると税率ごとに集計される', () => {
    const t = computeTotals(
      [
        { description: 'a', quantity: 2, unitPriceYen: 1000, taxRate: 10 },
        { description: 'b', quantity: 1, unitPriceYen: 333, taxRate: 8 },
      ],
      'round',
    )
    expect(t.byRate).toEqual([
      { rate: 10, subtotalYen: 2000, taxYen: 200 },
      { rate: 8, subtotalYen: 333, taxYen: 27 },
    ])
    expect(t.totalYen).toBe(2560)
  })
  it('端数処理方式で結果が変わる', () => {
    const items = [{ description: 'a', quantity: 1, unitPriceYen: 155, taxRate: 10 as const }]
    expect(computeTotals(items, 'floor').totalTaxYen).toBe(15)
    expect(computeTotals(items, 'round').totalTaxYen).toBe(16)
    expect(computeTotals(items, 'ceil').totalTaxYen).toBe(16)
  })
  it('明細が空なら0円', () => {
    expect(computeTotals([], 'floor').totalYen).toBe(0)
  })
  it('小数の数量でも金額が整数円になる', () => {
    const t = computeTotals([{ description: 'a', quantity: 1.5, unitPriceYen: 333, taxRate: 10 }], 'floor')
    expect(t.lineAmounts[0]).toBe(499)
  })
})

describe('登録番号', () => {
  it('全角・ハイフン入りも正規化して検証', () => {
    expect(normalizeRegNo('Ｔ１２３４-５６７８９０１２３')).toBe('T1234567890123')
    expect(isValidRegNoFormat('t1234567890123')).toBe(true)
    expect(isValidRegNoFormat('1234567890123')).toBe(false)
    expect(isValidRegNoFormat('T123')).toBe(false)
  })
})

describe('validateInvoice', () => {
  it('空の請求書は複数の警告を返す', () => {
    expect(validateInvoice(emptyInvoice('2026-11-20')).length).toBeGreaterThanOrEqual(4)
  })
  it('必須事項が揃えば警告なし', () => {
    const inv = {
      ...emptyInvoice('2026-11-20'),
      issuerName: '山田商店',
      issuerRegNo: 'T1234567890123',
      clientName: '株式会社テスト',
      items: [{ description: '制作費', quantity: 1, unitPriceYen: 10000, taxRate: 10 as const }],
    }
    expect(validateInvoice(inv)).toEqual([])
  })
})

describe('CSV', () => {
  const inv = {
    ...emptyInvoice('2026-11-20'),
    invoiceNumber: 'A-001',
    items: [
      { description: 'デザイン, ロゴ', quantity: 1, unitPriceYen: 1000, taxRate: 10 as const },
      { description: '=SUM(A1)', quantity: 1, unitPriceYen: 500, taxRate: 8 as const },
    ],
  }
  it('BOM付きで日本語を含み、数式注入を無害化する', () => {
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"デザイン, ロゴ"')
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain('合計(税込)')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvFileName({ ...inv, invoiceNumber: '請求-001' })).toBe('invoice-001-2026-11-20.csv')
    expect(safeFileName('日本語', 'csv')).toBe('invoice.csv')
  })
  it('formatYen', () => expect(formatYen(1234567)).toBe('¥1,234,567'))
})

describe('バックアップ往復', () => {
  it('書き出し→読み込みで同一になる', () => {
    const cur = { ...emptyInvoice('2026-11-20'), clientName: '株式会社テスト' }
    const b = parseBackup(JSON.stringify(buildBackup(cur, [{ id: '1', savedAt: '2026-11-20T00:00:00Z', invoice: cur }])))
    expect(b.current).toEqual(cur)
    expect(b.saved).toHaveLength(1)
  })
  it('BOM付きJSONも読める', () => {
    expect(parseBackup('﻿' + JSON.stringify(buildBackup(emptyInvoice('2026-11-20'), []))).saved).toEqual([])
  })
  it('不正なファイルは拒否', () => {
    expect(() => parseBackup('{')).toThrow()
    expect(() => parseBackup('{"schema":"other"}')).toThrow()
  })
  it('sanitizeInvoice は不正な型を補正する', () => {
    const s = sanitizeInvoice({ items: [{ description: 5, quantity: 'x', unitPriceYen: null, taxRate: 99 }], rounding: 'zzz' })
    expect(s.items[0]).toEqual({ description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 })
    expect(s.rounding).toBe('floor')
    expect(() => sanitizeInvoice(null)).toThrow()
  })
})
