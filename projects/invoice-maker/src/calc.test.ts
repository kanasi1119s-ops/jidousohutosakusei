import { describe, expect, it } from 'vitest'
import { applyRounding, calcTotals, isValidRegistrationNumber, parseNumberLoose } from './calc'
import { buildInvoiceCsv, escapeCsvField } from './csv'
import { emptyInvoice, parseInvoice } from './model'
import { parseInvoiceFromJsonText } from './storage'

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    const items = [
      { name: 'a', quantity: 1, unitPriceYen: 333, taxRate: 10 as const },
      { name: 'b', quantity: 1, unitPriceYen: 333, taxRate: 10 as const },
      { name: 'c', quantity: 1, unitPriceYen: 101, taxRate: 8 as const },
    ]
    const t = calcTotals(items, 'floor')
    expect(t.breakdowns[0]).toMatchObject({ taxRate: 10, subtotalYen: 666, taxYen: 66, totalYen: 732 })
    expect(t.breakdowns[1]).toMatchObject({ taxRate: 8, subtotalYen: 101, taxYen: 8, totalYen: 109 })
    expect(t.totalYen).toBe(841)
  })
  it('切り上げ・四捨五入', () => {
    expect(applyRounding(66.6, 'ceil')).toBe(67)
    expect(applyRounding(66.5, 'round')).toBe(67)
    expect(applyRounding(66.6, 'floor')).toBe(66)
  })
  it('小数数量でも浮動小数点誤差が出ない', () => {
    const t = calcTotals([{ name: 'x', quantity: 0.1 * 3, unitPriceYen: 1000, taxRate: 10 }], 'floor')
    expect(t.subtotalYen).toBe(300)
    expect(t.taxYen).toBe(30)
  })
  it('明細が空なら0円', () => {
    expect(calcTotals([], 'floor').totalYen).toBe(0)
  })
})

describe('入力の解釈', () => {
  it('全角数字・カンマを半角として読む', () => {
    expect(parseNumberLoose('１，２３４')).toBe(1234)
    expect(parseNumberLoose('１．５')).toBe(1.5)
    expect(Number.isNaN(parseNumberLoose('abc'))).toBe(true)
    expect(Number.isNaN(parseNumberLoose(''))).toBe(true)
  })
  it('登録番号の形式', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('t1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T１２３４５６７８９０１２３')).toBe(false)
  })
})

describe('CSV', () => {
  it('BOM付きで日本語ヘッダーを含む', () => {
    const inv = emptyInvoice()
    inv.items = [{ name: '制作費', quantity: 2, unitPriceYen: 5000, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品目,数量')
    expect(csv).toContain('請求金額(税込),,,,11000')
  })
  it('数式として解釈される先頭文字を無害化する', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('-5')).toBe('-5')
  })
})

describe('インポート検証', () => {
  it('往復できる', () => {
    const inv = emptyInvoice()
    inv.issuerName = '株式会社テスト'
    expect(parseInvoice(JSON.parse(JSON.stringify(inv)))).toEqual(inv)
  })
  it('BOM付きJSONも読める', () => {
    expect(parseInvoiceFromJsonText('﻿' + JSON.stringify(emptyInvoice())).items.length).toBe(1)
  })
  it('不正な形式は拒否する', () => {
    expect(() => parseInvoiceFromJsonText('{')).toThrow()
    expect(() => parseInvoice({ items: [] })).toThrow()
    expect(() => parseInvoice({ items: [{ name: 'a', quantity: 1, unitPriceYen: 1, taxRate: 5 }] })).toThrow()
    expect(() => parseInvoice({ issuerName: 1, items: [{ name: 'a', quantity: 1, unitPriceYen: 1, taxRate: 10 }] })).toThrow()
  })
})
