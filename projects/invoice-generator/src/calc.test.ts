import { describe, expect, it } from 'vitest'
import { calcInvoice, withholdingTax, type InvoiceInput } from './calc'
import { isValidRegistrationNumber, parseNumber, toHalfWidth } from './text'
import { buildItemsCsv, buildJson, downloadFileName, parseImportedJson } from './io'
import { emptyInvoice, sanitizeInvoice } from './model'

const base = (over: Partial<InvoiceInput>): InvoiceInput => ({ items: [], priceMode: 'exclusive', rounding: 'floor', withholding: false, ...over })

describe('calcInvoice', () => {
  it('税抜: 税率ごとに合計してから1回だけ端数処理する', () => {
    const t = calcInvoice(base({ items: [
      { name: 'a', quantity: 1, unitPrice: 105, taxRate: 10 },
      { name: 'b', quantity: 1, unitPrice: 105, taxRate: 10 },
      { name: 'c', quantity: 1, unitPrice: 1000, taxRate: 8 },
    ] }))
    expect(t.rates.map((r) => [r.rate, r.taxableYen, r.taxYen])).toEqual([[10, 210, 21], [8, 1000, 80]])
    expect(t.totalYen).toBe(1311)
  })
  it('明細ごとに端数処理するより税率ごとの合計後に処理した値になる', () => {
    const t = calcInvoice(base({ items: [
      { name: 'a', quantity: 1, unitPrice: 15, taxRate: 10 },
      { name: 'b', quantity: 1, unitPrice: 15, taxRate: 10 },
    ] }))
    expect(t.taxYen).toBe(3) // 30*10% = 3（明細ごと切り捨てなら 1+1=2）
  })
  it('税込: 税込合計から消費税額を内訳として算出', () => {
    const t = calcInvoice(base({ priceMode: 'inclusive', items: [{ name: 'a', quantity: 1, unitPrice: 1100, taxRate: 10 }] }))
    expect(t.rates[0]).toMatchObject({ taxableYen: 1000, taxYen: 100, totalYen: 1100 })
  })
  it('端数処理の切替', () => {
    const items = [{ name: 'a', quantity: 1, unitPrice: 105, taxRate: 10 as const }]
    expect(calcInvoice(base({ items, rounding: 'floor' })).taxYen).toBe(10)
    expect(calcInvoice(base({ items, rounding: 'round' })).taxYen).toBe(11)
    expect(calcInvoice(base({ items, rounding: 'ceil' })).taxYen).toBe(11)
  })
  it('小数の数量でも浮動小数点誤差が出ない', () => {
    const t = calcInvoice(base({ items: [{ name: 'a', quantity: 0.1, unitPrice: 30, taxRate: 10 }] }))
    expect(t.lineAmounts[0]).toBe(3)
  })
  it('巨大な数量×単価でも明細金額は上限で頭打ちになる', () => {
    const t = calcInvoice(base({ items: [{ name: 'a', quantity: 1e6, unitPrice: 1e9, taxRate: 10 }] }))
    expect(t.lineAmounts[0]).toBe(10_000_000_000)
    expect(Number.isSafeInteger(t.totalYen)).toBe(true)
  })
  it('空の明細は合計0', () => {
    expect(calcInvoice(base({})).totalYen).toBe(0)
  })
  it('源泉徴収: 100万円以下は10.21%、超過分は20.42%', () => {
    expect(withholdingTax(100000)).toBe(10210)
    expect(withholdingTax(1000000)).toBe(102100)
    expect(withholdingTax(1500000)).toBe(102100 + 102100)
    expect(withholdingTax(0)).toBe(0)
  })
  it('源泉徴収は税抜の報酬額を基準に差し引く', () => {
    const t = calcInvoice(base({ withholding: true, items: [{ name: 'a', quantity: 1, unitPrice: 100000, taxRate: 10 }] }))
    expect(t.withholdingYen).toBe(10210)
    expect(t.payableYen).toBe(110000 - 10210)
  })
})

describe('text', () => {
  it('全角数字を半角にして解釈する', () => {
    expect(toHalfWidth('１２，３４５')).toBe('12,345')
    expect(parseNumber('１２，３４５')).toBe(12345)
    expect(parseNumber('abc')).toBe(0)
    expect(parseNumber('-5')).toBe(0)
    expect(parseNumber('9'.repeat(30))).toBe(1e9)
  })
  it('登録番号の形式検証（全角・小文字も許容）', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('io', () => {
  it('CSVはBOM付きUTF-8で日本語を含む', () => {
    const inv = emptyInvoice()
    inv.items[0].name = 'デザイン費, 一式'
    const csv = buildItemsCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"デザイン費, 一式"')
  })
  it('JSONの往復と不正データの拒否', () => {
    const inv = emptyInvoice()
    inv.clientName = '株式会社テスト'
    expect(parseImportedJson(buildJson(inv))?.clientName).toBe('株式会社テスト')
    expect(parseImportedJson('﻿' + buildJson(inv))?.clientName).toBe('株式会社テスト')
    expect(parseImportedJson('{broken')).toBeNull()
    expect(parseImportedJson('{"schema":"other","invoice":{}}')).toBeNull()
  })
  it('sanitizeは不正値を安全な値に置換する', () => {
    const r = sanitizeInvoice({ items: [{ name: 5, quantity: -1, unitPrice: 'x', taxRate: 3 }], priceMode: 'zzz' })
    expect(r?.items[0]).toEqual({ name: '', quantity: 0, unitPrice: 0, taxRate: 10 })
    expect(r?.priceMode).toBe('exclusive')
  })
  it('ファイル名は英数字のみ', () => {
    const inv = emptyInvoice()
    inv.invoiceNumber = '請求書/INV-001'
    inv.issueDate = '2026-10-02'
    expect(downloadFileName(inv, 'csv')).toBe('invoice-INV-001-2026-10-02.csv')
  })
})
