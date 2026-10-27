import { describe, expect, it } from 'vitest'
import { buildInvoiceCsv, csvDownloadFileName, safeFileStem } from './csv'
import { emptyIssuer, newInvoice } from './storage'

describe('CSV', () => {
  const inv = () => {
    const i = newInvoice(emptyIssuer())
    i.invoiceNumber = 'INV-001'
    i.issueDate = '2026-10-27'
    i.clientName = '株式会社,テスト'
    i.items[0] = { id: 'a', name: '=HYPERLINK("x")', quantity: 2, unitPrice: 1000, taxRate: 10 }
    return i
  }
  it('BOM付きで日本語ヘッダーを含み、CRLFで終わる', () => {
    const csv = buildInvoiceCsv(inv())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
  it('カンマを含む値を引用符で囲み、数式として解釈される先頭文字を無効化する', () => {
    const csv = buildInvoiceCsv(inv())
    expect(csv).toContain('"株式会社,テスト"')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
  it('合計行を出力する', () => {
    expect(buildInvoiceCsv(inv())).toContain(',,,合計(税込),,,,2200')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvDownloadFileName(inv())).toBe('invoice-INV-001-2026-10-27.csv')
    expect(safeFileStem('請求書第１号', 'draft')).toBe('1')
    expect(safeFileStem('請求書', 'draft')).toBe('draft')
  })
})
