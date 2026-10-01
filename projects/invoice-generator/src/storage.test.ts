import { describe, expect, it } from 'vitest'
import { newInvoice } from './calc'
import { buildInvoiceCsv, csvFileName, safeFileStem } from './csv'
import { parseImport, sanitizeInvoice, upsertSaved } from './storage'

describe('sanitizeInvoice', () => {
  it('不正な値を安全な既定値に置き換える', () => {
    const inv = sanitizeInvoice({
      items: [{ name: 5, quantity: 'x', unitPrice: Infinity, taxRate: 99 }],
      priceMode: 'bogus',
      rounding: 'bogus',
      honorific: 'bogus',
      issuer: null,
    })
    expect(inv.items[0]).toEqual({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
    expect(inv.priceMode).toBe('exclusive')
    expect(inv.rounding).toBe('floor')
    expect(inv.honorific).toBe('御中')
    expect(inv.issuer.name).toBe('')
  })
  it('明細は100行までに制限する', () => {
    const inv = sanitizeInvoice({ items: Array.from({ length: 500 }, () => ({})) })
    expect(inv.items).toHaveLength(100)
  })
  it('オブジェクト以外はエラー', () => {
    expect(() => sanitizeInvoice(null)).toThrow()
  })
})

describe('parseImport', () => {
  it('BOM付きでも読める', () => {
    const inv = newInvoice()
    inv.clientName = '株式会社テスト'
    const text = '\uFEFF' + JSON.stringify({ version: 1, invoices: [inv] })
    expect(parseImport(text)[0].clientName).toBe('株式会社テスト')
  })
  it('壊れたJSON・空はエラー', () => {
    expect(() => parseImport('not json')).toThrow('JSON')
    expect(() => parseImport('{"invoices":[]}')).toThrow('請求書')
  })
})

describe('upsertSaved', () => {
  it('同一idは上書きし新しい順に並べる', () => {
    const a = newInvoice()
    const b = newInvoice()
    let list = upsertSaved([], a)
    list = upsertSaved(list, b)
    list = upsertSaved(list, { ...a, number: 'A-1' })
    expect(list.map((i) => i.id)).toEqual([a.id, b.id])
    expect(list[0].number).toBe('A-1')
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で日本語ヘッダーを持ち、CRLFで終わる', () => {
    const inv = newInvoice()
    inv.items = [{ name: 'デザイン費', quantity: 2, unitPrice: 5000, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量')
    expect(csv).toContain('デザイン費,2,5000,10%,10000')
    expect(csv).toContain('請求金額合計(税込),,,,11000')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
  it('式として解釈される先頭文字とカンマ・引用符を無害化する', () => {
    const inv = newInvoice()
    inv.items = [{ name: '=HYPERLINK("x"),a', quantity: 1, unitPrice: 1, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv).toContain('"\'=HYPERLINK(""x""),a"')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileStem('請求書 2026/001')).toBe('2026-001')
    expect(safeFileStem('日本語のみ')).toBe('draft')
    const inv = newInvoice()
    inv.number = 'INV-001'
    inv.issueDate = '2026-10-01'
    expect(csvFileName(inv)).toBe('invoice-INV-001-2026-10-01.csv')
  })
})
