import { describe, expect, it } from 'vitest'
import { buildInvoiceListCsv } from './csv'
import { emptyInvoice, validateInvoice } from './model'
import { exportJsonBlob, mergeInvoices, parseImport } from './storage'

function blobText(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(b, 'utf-8')
  })
}

describe('データの検証・往復', () => {
  it('エクスポートしたJSONをインポートできる（日本語も保持）', async () => {
    const inv = emptyInvoice()
    inv.clientName = '株式会社テスト'
    inv.items = [{ name: '制作費（デザイン）', quantity: 2, unitPrice: 5000, taxRate: 10 }]
    const text = await blobText(exportJsonBlob([inv]))
    const back = parseImport(text)
    expect(back[0].clientName).toBe('株式会社テスト')
    expect(back[0].items[0].name).toBe('制作費（デザイン）')
  })
  it('BOM付きJSONも読める', () => {
    const text = '\uFEFF' + JSON.stringify({ invoices: [emptyInvoice()] })
    expect(parseImport(text)).toHaveLength(1)
  })
  it('不正なデータは拒否する', () => {
    expect(() => parseImport('not json')).toThrow()
    expect(() => parseImport('{"invoices": [{"items": "x"}]}')).toThrow()
    expect(() => validateInvoice({ items: [{ name: 'a', quantity: 'x', unitPrice: 1, taxRate: 10 }], rounding: 'floor', priceMode: 'exclusive' })).toThrow()
    expect(() => validateInvoice({ items: [{ name: 'a', quantity: 1, unitPrice: 1, taxRate: 5 }], rounding: 'floor', priceMode: 'exclusive' })).toThrow()
  })
  it('同じIDはマージ時に上書きされる', () => {
    const a = emptyInvoice()
    const b = { ...a, clientName: '更新後' }
    expect(mergeInvoices([a], [b])).toEqual([b])
  })
})

describe('CSV', () => {
  it('先頭にBOMがあり、数式として解釈される文字列は無害化される', () => {
    const inv = emptyInvoice()
    inv.number = 'A-001'
    inv.clientName = '=HYPERLINK("http://example.com")'
    inv.subject = '件名,カンマ入り'
    const csv = buildInvoiceListCsv([inv])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain('"件名,カンマ入り"')
    expect(csv).toContain('請求書番号')
  })
})

describe('金額の上限', () => {
  it('1行1兆円を超える明細のデータは拒否する', () => {
    expect(() =>
      validateInvoice({ items: [{ name: 'a', quantity: 1e6, unitPrice: 1e10, taxRate: 10 }], rounding: 'floor', priceMode: 'exclusive' }),
    ).toThrow()
  })
})
