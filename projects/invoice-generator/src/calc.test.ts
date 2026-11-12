import { describe, expect, it } from 'vitest'
import {
  computeTotals, formatYen, isValidRegistrationNumber, lineAmount, nextInvoiceNumber, parseNumber,
  roundTax, validateInvoice, type Invoice, type LineItem,
} from './calc'
import { buildInvoicesCsv, csvText } from './csv'
import { parseBackup, serializeBackup, emptyData } from './storage'

const item = (p: Partial<LineItem> = {}): LineItem => ({ description: '制作費', quantity: 1, unitPriceYen: 1000, taxRate: 10, ...p })
const invoice = (p: Partial<Invoice> = {}): Invoice => ({
  id: 'a', number: 'INV-0001', issueDate: '2026-11-12', dueDate: '2026-12-31', qualified: true,
  issuer: { name: '株式会社テスト', registrationNumber: 'T1234567890123', address: '', bank: '' },
  clientName: '顧客株式会社', items: [item()], rounding: 'floor', notes: '', updatedAt: '', ...p,
})

describe('計算', () => {
  it('税額は税率ごとに合計してから1回だけ端数処理する', () => {
    // 行ごとに処理すると 33*10%=3.3→3 を3回で9、合計処理だと 99*10%=9.9→9(切捨)/10(四捨五入)
    const items = [item({ unitPriceYen: 33 }), item({ unitPriceYen: 33 }), item({ unitPriceYen: 33 })]
    expect(computeTotals(items, 'round').taxYen).toBe(10)
    expect(computeTotals(items, 'floor').taxYen).toBe(9)
    expect(computeTotals(items, 'ceil').taxYen).toBe(10)
  })
  it('10%と8%を分けて集計する', () => {
    const t = computeTotals([item({ unitPriceYen: 1000 }), item({ unitPriceYen: 500, taxRate: 8 })], 'floor')
    expect(t.groups.map((g) => [g.rate, g.subtotalYen, g.taxYen])).toEqual([[10, 1000, 100], [8, 500, 40]])
    expect(t.totalYen).toBe(1640)
  })
  it('1円未満の明細金額は切り捨て、小数の数量に対応', () => {
    expect(lineAmount(item({ quantity: 1.5, unitPriceYen: 999 }))).toBe(1498)
    expect(lineAmount(item({ quantity: 0.1, unitPriceYen: 30 }))).toBe(3)
  })
  it('NaNの行は0円扱いで落ちない', () => {
    expect(computeTotals([item({ quantity: NaN })], 'floor').totalYen).toBe(0)
  })
  it('roundTaxは整数演算で境界を正しく丸める', () => {
    expect(roundTax(5, 10, 'round')).toBe(1) // 0.5 → 1
    expect(roundTax(4, 10, 'round')).toBe(0)
    expect(roundTax(1_000_000_000_000, 10, 'floor')).toBe(100_000_000_000)
  })
})

describe('検証と正規化', () => {
  it('登録番号の形式（全角・ハイフン混じりも許容）', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('t-1234-5678-90123')).toBe(true)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T123')).toBe(false)
  })
  it('全角数字・カンマを数値化', () => {
    expect(parseNumber('１，２３４')).toBe(1234)
    expect(parseNumber('１．５')).toBe(1.5)
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
  it('適格請求書で登録番号が不正ならエラー、非適格なら不要', () => {
    const bad = invoice({ issuer: { name: 'x', registrationNumber: '', address: '', bank: '' } })
    expect(validateInvoice(bad).join()).toContain('登録番号')
    expect(validateInvoice({ ...bad, qualified: false })).toEqual([])
  })
  it('空・不正・巨大入力・期限逆転を検出', () => {
    const errs = validateInvoice(invoice({
      clientName: '', dueDate: '2026-01-01',
      items: [item({ description: '', quantity: 0 }), item({ unitPriceYen: 1.5 }), item({ unitPriceYen: 1e12 })],
    }))
    expect(errs.length).toBeGreaterThanOrEqual(6)
    expect(validateInvoice(invoice({ items: [] })).join()).toContain('明細')
  })
  it('請求書番号の自動採番', () => {
    expect(nextInvoiceNumber([])).toBe('INV-0001')
    expect(nextInvoiceNumber(['INV-0009', 'INV-0002'])).toBe('INV-0010')
    expect(nextInvoiceNumber(['2026-099'])).toBe('2026-100')
  })
  it('円表示', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatYen(0)).toBe('¥0')
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8・日本語ヘッダー・CRLF', () => {
    const csv = buildInvoicesCsv([invoice()])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv).toContain('\r\n')
    expect(csv).toContain('顧客株式会社')
  })
  it('式インジェクションを無害化しカンマ・引用符をエスケープ', () => {
    expect(csvText('=1+1')).toBe("'=1+1")
    expect(csvText('a,"b"')).toBe('"a,""b"""')
  })
})

describe('バックアップ', () => {
  it('往復できる', () => {
    const data = { ...emptyData(), invoices: [invoice()] }
    expect(parseBackup(serializeBackup(data)).invoices[0]).toEqual(data.invoices[0])
  })
  it('BOM付きJSONも読める', () => {
    expect(parseBackup('﻿' + serializeBackup(emptyData())).invoices).toEqual([])
  })
  it('不正な形式は拒否し、型の壊れた値は無害化する', () => {
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup('{"version":2,"invoices":[]}')).toThrow()
    const d = parseBackup('{"version":1,"invoices":[{"id":"z","items":[{"quantity":"x","taxRate":5}]},{"nope":1}]}')
    expect(d.invoices).toHaveLength(1)
    expect(d.invoices[0].items[0]).toMatchObject({ quantity: 0, taxRate: 10 })
  })
})
