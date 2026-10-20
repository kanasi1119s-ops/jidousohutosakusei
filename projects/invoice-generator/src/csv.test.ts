import { describe, it, expect } from 'vitest'
import { buildInvoiceCsv, safeFileName } from './csv'
import { dataToJsonBlob, dataToJsonText, emptyData, parseDataFromJsonText } from './storage'
import type { Invoice } from './types'

const invoice: Invoice = {
  id: 'a1',
  number: '202610-001',
  issueDate: '2026-10-20',
  dueDate: '2026-11-30',
  clientName: '株式会社サンプル',
  items: [
    { name: '=SUM(A1)', quantity: 1, unitPriceYen: 1000, taxRate: 10 },
    { name: 'デザイン, "一式"', quantity: 2, unitPriceYen: 500, taxRate: 8 },
  ],
  rounding: 'floor',
  withholding: false,
  notes: '',
}

describe('CSV', () => {
  it('BOM付きで日本語ヘッダーを含む', () => {
    const csv = buildInvoiceCsv(invoice)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv).toContain('株式会社サンプル')
  })
  it('数式インジェクションを無効化し、カンマ・引用符をエスケープする', () => {
    const csv = buildInvoiceCsv(invoice)
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain('"デザイン, ""一式"""')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('202610-001', 'csv')).toBe('invoice-202610-001.csv')
    expect(safeFileName('請求書', 'json')).toBe('invoice-invoice.json')
  })
})

describe('JSON往復', () => {
  it('エクスポートしたデータをそのまま復元できる', () => {
    const data = { ...emptyData(), invoices: [invoice] }
    data.issuer.name = '山田商店'
    const text = dataToJsonText(data)
    expect(parseDataFromJsonText(text)).toEqual(data)
    expect(parseDataFromJsonText('﻿' + text)).toEqual(data)
  })
  it('不正な形式は例外', () => {
    expect(() => parseDataFromJsonText('{"foo":1}')).toThrow()
    expect(() => parseDataFromJsonText('not json')).toThrow()
    expect(() => parseDataFromJsonText('{"version":1,"invoices":[{"id":"x","items":[{"quantity":"a"}]}]}')).toThrow()
  })
})

describe('JSON Blob', () => {
  it('charset付きMIMEで出力する', () => {
    expect(dataToJsonBlob(emptyData()).type).toBe('application/json;charset=utf-8')
  })
})
