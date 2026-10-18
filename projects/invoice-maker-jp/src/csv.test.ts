import { describe, expect, it } from 'vitest'
import { computeTotals } from './calc'
import { buildItemsCsv, buildItemsCsvBlob, csvFileName } from './csv'
import { emptyDoc } from './invoice'

function doc() {
  const d = emptyDoc(new Date(2026, 9, 18))
  d.number = 'INV-0001'
  d.items = [
    { name: '制作費, 一式', quantity: 1, unitPriceYen: 1000, taxRate: 10 },
    { name: '=HYPERLINK("x")', quantity: 2, unitPriceYen: -50, taxRate: 8 },
  ]
  return d
}

describe('CSV', () => {
  it('BOM付きUTF-8で日本語ヘッダーを含み、特殊文字をエスケープする', async () => {
    const d = doc()
    const csv = buildItemsCsv(d, computeTotals(d.items, d.priceMode, d.rounding))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名')
    expect(csv).toContain('"制作費, 一式"')
    expect(csv).toContain("'=HYPERLINK(")
    expect(csv).toContain(',-50,')
  })
  it('Blob の type に charset=utf-8 が付く', () => {
    const d = doc()
    expect(buildItemsCsvBlob(d, computeTotals(d.items, d.priceMode, d.rounding)).type).toBe('text/csv;charset=utf-8')
  })
  it('ファイル名は英数字のみ', () => {
    const d = doc()
    expect(csvFileName(d)).toBe('invoice-INV-0001-2026-10-18.csv')
    d.number = '請求書'
    expect(csvFileName(d)).toBe('invoice-draft-2026-10-18.csv')
  })
})
