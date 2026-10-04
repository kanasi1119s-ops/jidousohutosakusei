import { describe, expect, it } from 'vitest'
import { newInvoice } from './calc'
import { buildInvoiceCsv, safeFileStem } from './csv'

describe('csv', () => {
  it('BOM付きUTF-8・CRLF・日本語ヘッダー', () => {
    const inv = { ...newInvoice(), items: [{ description: '制作,費', quantity: 2, unitPriceYen: 500, taxRate: 10 as const }] }
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品目')
    expect(csv).toContain('"制作,費"')
    expect(csv).toContain('\r\n')
    expect(csv).toContain(',1000\r\n')
  })
  it('数式として解釈される先頭文字を無害化する', () => {
    const inv = { ...newInvoice(), items: [{ description: '=SUM(A1)', quantity: 1, unitPriceYen: 1, taxRate: 10 as const }] }
    expect(buildInvoiceCsv(inv)).toContain("'=SUM(A1)")
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileStem('請求-001', '2026-10-04')).toBe('invoice-001-2026-10-04')
    expect(safeFileStem('請求', '2026-10-04')).toBe('invoice-2026-10-04')
  })
})
