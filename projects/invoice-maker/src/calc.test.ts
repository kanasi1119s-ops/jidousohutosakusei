import { describe, expect, it } from 'vitest'
import { applyRounding, calcTotals, calcWithholding, isValidRegistrationNumber, parseNumber, type LineItem } from './calc'
import { buildInvoiceCsv, escapeCsvField, safeFileName, stripBom } from './csv'
import { emptyInvoice, parseDataFromJsonText, emptyData } from './model'

const item = (q: number, p: number, r: 10 | 8 | 0): LineItem => ({ id: 'x', description: 'd', quantity: q, unitPriceYen: p, taxRate: r })

describe('parseNumber', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(parseNumber('¥5,000円')).toBe(5000)
    expect(parseNumber('-3.5')).toBe(-3.5)
  })
  it('不正な入力は NaN', () => {
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1e5')).toBeNaN()
    expect(parseNumber('99999999999999999')).toBeNaN()
  })
})

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する（明細ごとの端数合計とは異なる）', () => {
    // 税抜 33円 x 3行 = 99円。1行ごとに切り捨てると 3x3=9円、税率ごとなら 9.9 → 9円
    const t = calcTotals([item(1, 33, 10), item(1, 33, 10), item(1, 33, 10)], 'floor', false)
    expect(t.byRate).toEqual([{ rate: 10, subtotalYen: 99, taxYen: 9 }])
    expect(t.totalYen).toBe(108)
    const r = calcTotals([item(1, 33, 10), item(1, 33, 10), item(1, 33, 10)], 'round', false)
    expect(r.taxYen).toBe(10)
    const c = calcTotals([item(1, 33, 10)], 'ceil', false)
    expect(c.taxYen).toBe(4)
  })
  it('10%・8%・非課税を分けて集計する', () => {
    const t = calcTotals([item(2, 1000, 10), item(1, 500, 8), item(1, 300, 0)], 'floor', false)
    expect(t.byRate.map((r) => [r.rate, r.subtotalYen, r.taxYen])).toEqual([
      [10, 2000, 200],
      [8, 500, 40],
      [0, 300, 0],
    ])
    expect(t.totalYen).toBe(2000 + 200 + 500 + 40 + 300)
  })
  it('小数の数量でも浮動小数点誤差で境界がずれない', () => {
    expect(calcTotals([item(0.1, 30, 10)], 'floor', false).lineAmountsYen[0]).toBe(3)
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
  })
  it('値引き行（負の単価）を扱える', () => {
    const t = calcTotals([item(1, 10000, 10), item(1, -1000, 10)], 'floor', false)
    expect(t.subtotalYen).toBe(9000)
    expect(t.taxYen).toBe(900)
  })
  it('源泉徴収を差し引く', () => {
    const t = calcTotals([item(1, 100000, 10)], 'floor', true)
    expect(t.withholdingYen).toBe(10210)
    expect(t.payableYen).toBe(110000 - 10210)
  })
  it('空の明細は 0', () => {
    expect(calcTotals([], 'floor', true).payableYen).toBe(0)
  })
})

describe('calcWithholding', () => {
  it('100万円以下は 10.21%、超える部分は 20.42%', () => {
    expect(calcWithholding(1_000_000)).toBe(102_100)
    expect(calcWithholding(1_500_000)).toBe(102_100 + 102_100)
    expect(calcWithholding(0)).toBe(0)
    expect(calcWithholding(12345)).toBe(1260)
  })
})

describe('登録番号', () => {
  it('T+13桁のみ有効（全角も正規化）', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T123')).toBe(false)
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で日本語を含み、数式インジェクションを無害化する', () => {
    const inv = emptyInvoice()
    inv.number = '2026-001'
    inv.clientName = '株式会社テスト'
    inv.items = [{ id: 'a', description: '=HYPERLINK("x")', quantity: 1, unitPriceYen: 1000, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('株式会社テスト')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(stripBom(csv).charCodeAt(0)).not.toBe(0xfeff)
    expect(csv).not.toContain('�')
  })
  it('カンマ・改行・引用符をエスケープする', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('a\nb')).toBe('"a\nb"')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('invoice', '請求書-2026/001', 'csv', '2026-11-04')).toBe('invoice-2026001-2026-11-04.csv')
    expect(safeFileName('invoice', '', 'csv', '')).toBe('invoice-undated.csv')
  })
})

describe('JSONインポート', () => {
  it('往復できる', () => {
    const d = emptyData()
    d.issuer.name = '山田太郎'
    d.invoices.push(emptyInvoice())
    const back = parseDataFromJsonText(JSON.stringify(d))
    expect(back.issuer.name).toBe('山田太郎')
    expect(back.invoices).toHaveLength(1)
  })
  it('BOM付きでも読める', () => {
    expect(() => parseDataFromJsonText('﻿' + JSON.stringify(emptyData()))).not.toThrow()
  })
  it('不正な形式・不正な値は拒否またはサニタイズ', () => {
    expect(() => parseDataFromJsonText('not json')).toThrow()
    expect(() => parseDataFromJsonText('{"a":1}')).toThrow()
    const d = JSON.parse(JSON.stringify(emptyData()))
    d.invoices = [{ items: [{ quantity: 'x', unitPriceYen: null, taxRate: 99 }], rounding: 'bad' }]
    const back = parseDataFromJsonText(JSON.stringify(d))
    expect(back.invoices[0].items[0]).toMatchObject({ quantity: 0, unitPriceYen: 0, taxRate: 10 })
    expect(back.invoices[0].rounding).toBe('floor')
  })
})
