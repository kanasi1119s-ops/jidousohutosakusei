import { describe, expect, it } from 'vitest'
import { buildInvoiceCsv, safeFileName } from './csv'
import { isValidRegNo, newInvoice, sanitizeInvoice, validateInvoice } from './model'
import { parseImport, exportJson } from './storage'

describe('登録番号', () => {
  it('T+13桁のみ有効（全角入力は正規化）', () => {
    expect(isValidRegNo('T1234567890123')).toBe(true)
    expect(isValidRegNo('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegNo('T123')).toBe(false)
    expect(isValidRegNo('1234567890123')).toBe(false)
  })
})

describe('validateInvoice', () => {
  it('必須項目の不足を検出する', () => {
    expect(validateInvoice(newInvoice()).length).toBeGreaterThan(3)
  })
  it('全部入力すればエラーなし', () => {
    const inv = newInvoice()
    inv.sellerName = '山田商店'
    inv.sellerRegNo = 'T1234567890123'
    inv.buyerName = '株式会社サンプル'
    inv.items = [{ name: '制作費', qty: 1, unitPrice: 1000, taxRate: 10 }]
    expect(validateInvoice(inv)).toEqual([])
  })
})

describe('CSV', () => {
  it('BOM付きで日本語ヘッダーを含み、数式インジェクションを無害化する', () => {
    const inv = newInvoice()
    inv.items = [{ name: '=cmd|calc', qty: 1, unitPrice: 100, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
    expect(csv).toContain("'=cmd|calc")
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('invoice', '請求-001/あ', 'csv')).toBe('invoice--001.csv')
    expect(safeFileName('invoice', '日本語', 'csv')).toBe('invoice-draft.csv')
  })
})

describe('インポート', () => {
  it('エクスポート→インポートの往復で日本語が保たれる', async () => {
    const inv = newInvoice()
    inv.buyerName = '株式会社テスト'
    const text = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.readAsText(exportJson([inv]))
    })
    expect(parseImport(text)?.[0].buyerName).toBe('株式会社テスト')
    expect(parseImport('﻿' + text)).not.toBeNull()
  })
  it('壊れたJSONや不正形式は null', () => {
    expect(parseImport('{')).toBeNull()
    expect(parseImport('{"invoices":[{"items":"x"}]}')).toBeNull()
    expect(sanitizeInvoice(null)).toBeNull()
  })
})
