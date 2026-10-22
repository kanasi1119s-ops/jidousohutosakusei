import { describe, expect, it } from 'vitest'
import { computeInvoice } from './calc'
import { buildItemsCsv, buildItemsCsvBlob, csvFileName, escapeCsvField, jsonFileName } from './csv'
import { emptyDoc } from './types'

function sampleDoc() {
  const doc = emptyDoc(new Date('2026-10-22T00:00:00Z'))
  doc.items = [
    { description: '制作費, "初回"', quantity: '2', unitPrice: '1000', taxRate: 10 },
    { description: '=HYPERLINK("x")', quantity: '1', unitPrice: '500', taxRate: 8 },
  ]
  return doc
}

describe('CSV出力', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含む', () => {
    const doc = sampleDoc()
    const calc = computeInvoice(doc.items, doc.rounding, false)
    const csv = buildItemsCsv(doc, calc)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量,単価(円),税率(%),金額(税抜・円)')
    const bytes = new TextEncoder().encode(csv)
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(buildItemsCsvBlob(doc, calc).type).toBe('text/csv;charset=utf-8')
  })
  it('カンマと引用符をエスケープする', () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""')
  })
  it('数式として解釈される先頭文字を無効化する', () => {
    const doc = sampleDoc()
    const csv = buildItemsCsv(doc, computeInvoice(doc.items, doc.rounding, false))
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"")
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvFileName('2026-10-22')).toBe('invoice-items-2026-10-22.csv')
    expect(csvFileName('令和')).toBe('invoice-items-export.csv')
    expect(jsonFileName('2026-10-22')).toBe('invoice-maker-data-2026-10-22.json')
  })
})
