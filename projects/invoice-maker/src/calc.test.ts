import { describe, expect, it } from 'vitest'
import { applyRounding, calcTotals, isValidRegistrationNo, normalizeRegistrationNo, parseNumber, validateInvoice } from './calc'
import { buildInvoiceCsv, safeFileName } from './csv'
import { exportJson, newInvoice, parseImport, sanitizeInvoice } from './storage'

describe('calc', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    const items = [
      { name: 'a', quantity: 1, unitPrice: 105, taxRate: 10 as const },
      { name: 'b', quantity: 1, unitPrice: 105, taxRate: 10 as const },
      { name: 'c', quantity: 1, unitPrice: 101, taxRate: 8 as const },
    ]
    const t = calcTotals(items, 'floor')
    expect(t.byRate[0]).toEqual({ rate: 10, subtotal: 210, tax: 21 })
    expect(t.byRate[1]).toEqual({ rate: 8, subtotal: 101, tax: 8 })
    expect(t.total).toBe(210 + 21 + 101 + 8)
  })
  it('明細ごとに丸めると結果が異なるケースで合計に対して丸める', () => {
    const items = [1, 2, 3].map(() => ({ name: 'x', quantity: 1, unitPrice: 15, taxRate: 10 as const }))
    expect(calcTotals(items, 'floor').tax).toBe(4) // 45*10% = 4.5 → 4（明細ごとなら1*3=3）
    expect(calcTotals(items, 'round').tax).toBe(5)
    expect(calcTotals(items, 'ceil').tax).toBe(5)
  })
  it('浮動小数点誤差を吸収する', () => {
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
    expect(calcTotals([{ name: 'x', quantity: 1.1, unitPrice: 100, taxRate: 10 }], 'floor').subtotal).toBe(110)
  })
  it('全角数字・カンマを解釈する', () => {
    expect(parseNumber('１,２３４')).toBe(1234)
    expect(parseNumber('abc')).toBe(0)
  })
  it('登録番号の検証と正規化', () => {
    expect(isValidRegistrationNo('T1234567890123')).toBe(true)
    expect(isValidRegistrationNo('T123')).toBe(false)
    expect(normalizeRegistrationNo('Ｔ１２３４５６７８９０１２３')).toBe('T1234567890123')
    expect(normalizeRegistrationNo('t-1234567890123')).toBe('T1234567890123')
  })
  it('必須項目チェック', () => {
    const inv = newInvoice('2026-11-03')
    expect(validateInvoice(inv).length).toBeGreaterThanOrEqual(4)
  })
})

describe('csv/storage', () => {
  const inv = { ...newInvoice('2026-11-03'), invoiceNo: 'A-001', items: [{ name: '=cmd,"x"', quantity: 2, unitPrice: 500, taxRate: 10 as const }] }
  it('CSVはBOM付きで、式インジェクションを無効化する', () => {
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain(`"'=cmd,""x"""`)
    expect(csv).toContain('合計(税込)')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName({ ...inv, invoiceNo: '請求-001' }, 'csv')).toBe('invoice--001-2026-11-03.csv')
    expect(safeFileName({ ...inv, invoiceNo: '請求' }, 'json')).toBe('invoice-draft-2026-11-03.json')
  })
  it('JSON往復とBOM付き読み込み', () => {
    const json = exportJson([inv])
    expect(parseImport('﻿' + json)[0].items[0].name).toBe('=cmd,"x"')
  })
  it('不正なインポートは安全な値に置換される', () => {
    const s = sanitizeInvoice({ items: [{ name: 5, quantity: 'x', taxRate: 99 }], rounding: 'evil' })!
    expect(s.items[0]).toEqual({ name: '', quantity: 0, unitPrice: 0, taxRate: 10 })
    expect(s.rounding).toBe('floor')
    expect(parseImport('{"invoices":"x"}')).toEqual([])
  })
})
