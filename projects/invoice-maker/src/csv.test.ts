import { describe, expect, it } from 'vitest'
import { calculateInvoice } from './calc'
import { buildInvoiceCsv, csvDownloadFileName, safeFileName } from './csv'
import { nextInvoiceNumber, parseDataFromJsonText, sanitizeAppData, type Invoice } from './storage'

const inv: Invoice = {
  id: 'x',
  number: 'INV-1',
  issueDate: '2026-10-06',
  dueDate: '',
  customerName: '株式会社テスト',
  subject: '',
  notes: '',
  items: [
    { name: 'デザイン費, "一式"', quantity: 1, unitPrice: 10000, taxRate: 10 },
    { name: '=SUM(A1)', quantity: 2, unitPrice: 100, taxRate: 8 },
  ],
  priceMode: 'exclusive',
  rounding: 'floor',
  withholding: false,
  updatedAt: '',
}

describe('CSV', () => {
  const csv = buildInvoiceCsv(inv, calculateInvoice(inv))
  it('BOM付きUTF-8で始まる', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const bytes = new TextEncoder().encode(csv)
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
  })
  it('日本語・カンマ・引用符を正しくエスケープする', () => {
    expect(csv).toContain('株式会社テスト')
    expect(csv).toContain('"デザイン費, ""一式"""')
  })
  it('数式インジェクションを無効化する', () => {
    expect(csv).toContain("'=SUM(A1)")
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('請求書 テスト', 'csv')).toBe('invoice.csv')
    expect(csvDownloadFileName('INV-2026/01', new Date(2026, 9, 6))).toBe('invoice-INV-2026-01-2026-10-06.csv')
  })
})

describe('インポート検証', () => {
  it('BOM付きJSONを読める', () => {
    const d = parseDataFromJsonText('﻿' + JSON.stringify({ version: 1, issuer: { name: '山田' }, invoices: [] }))
    expect(d.issuer.name).toBe('山田')
  })
  it('不正な形式は拒否する', () => {
    expect(() => parseDataFromJsonText('not json')).toThrow()
    expect(() => parseDataFromJsonText('[]')).toThrow()
    expect(() => sanitizeAppData({ version: 2 })).toThrow()
  })
  it('不正な明細は除外し、税率は10/8/0に正規化する', () => {
    const d = sanitizeAppData({
      version: 1,
      invoices: [{ items: [{ name: 1, quantity: 'a', unitPrice: 1 }, { name: 'ok', quantity: 1, unitPrice: 5, taxRate: 99 }] }],
    })
    expect(d.invoices[0].items).toHaveLength(1)
    expect(d.invoices[0].items[0].taxRate).toBe(10)
  })
})

describe('請求書番号の採番', () => {
  it('既存番号と重複しない（途中を削除しても衝突しない）', () => {
    expect(nextInvoiceNumber('2026-10-06', [])).toBe('INV-20261006-001')
    expect(nextInvoiceNumber('2026-10-06', ['INV-20261006-001', 'INV-20261006-002'])).toBe('INV-20261006-003')
    expect(nextInvoiceNumber('2026-10-06', ['INV-20261006-002'])).toBe('INV-20261006-001')
  })
})
