import { describe, expect, it } from 'vitest'
import {
  applyRounding,
  calcTotals,
  isValidRegistrationNumber,
  lineAmount,
  normalizeRegistrationNumber,
  parseNumberInput,
} from './calc'
import { buildInvoiceCsv, csvFileName } from './csv'
import { emptyInvoice, sanitizeInvoice } from './model'
import { invoiceToJson, parseInvoiceJson } from './storage'

describe('parseNumberInput', () => {
  it('全角数字・カンマ・円記号を処理する', () => {
    expect(parseNumberInput('１２，３４５円')).toBe(12345)
    expect(parseNumberInput('¥1,000')).toBe(1000)
    expect(parseNumberInput('１．５')).toBe(1.5)
  })
  it('不正値は NaN', () => {
    expect(parseNumberInput('')).toBeNaN()
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('1e3')).toBeNaN()
    expect(parseNumberInput('99999999999999999999')).toBeNaN() // Round2で追加: 巨大入力
  })
})

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    const items = [
      { name: 'a', quantity: 1, unitPrice: 105, taxRate: 10 as const },
      { name: 'b', quantity: 1, unitPrice: 105, taxRate: 10 as const },
      { name: 'c', quantity: 1, unitPrice: 99, taxRate: 8 as const },
    ]
    const t = calcTotals(items, 'floor')
    // 10%: 210*0.1=21 / 8%: 99*0.08=7.92→7
    expect(t.byRate).toEqual([
      { rate: 10, subtotal: 210, tax: 21 },
      { rate: 8, subtotal: 99, tax: 7 },
    ])
    expect(t.total).toBe(210 + 21 + 99 + 7)
  })
  it('端数処理の方式を切り替えられる', () => {
    const items = [{ name: 'a', quantity: 1, unitPrice: 99, taxRate: 8 as const }]
    expect(calcTotals(items, 'floor').tax).toBe(7)
    expect(calcTotals(items, 'round').tax).toBe(8)
    expect(calcTotals(items, 'ceil').tax).toBe(8)
  })
  it('明細ごとに端数処理すると差が出るケースでも合計に対して1回だけ処理する', () => {
    const items = Array.from({ length: 3 }, () => ({ name: 'x', quantity: 1, unitPrice: 15, taxRate: 10 as const }))
    // 合計45 → 4.5 → 切り捨て4（明細ごとだと 1.5→1 ×3 = 3 になってしまう）
    expect(calcTotals(items, 'floor').tax).toBe(4)
  })
  it('空・ゼロは0', () => {
    expect(calcTotals([], 'floor').total).toBe(0)
  })
})

describe('applyRounding / lineAmount', () => {
  it('浮動小数点誤差に耐える', () => {
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
    expect(lineAmount({ name: '', quantity: 1.1, unitPrice: 1000, taxRate: 10 })).toBe(1100)
  })
  it('非有限値は0', () => {
    expect(lineAmount({ name: '', quantity: NaN, unitPrice: 1, taxRate: 10 })).toBe(0)
  })
})

describe('登録番号', () => {
  it('全角を半角化して検証する', () => {
    expect(normalizeRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe('T1234567890123')
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('t-1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('CSV / JSON', () => {
  const inv = { ...emptyInvoice('2026-11-07'), invoiceNumber: 'INV-0042' }
  inv.items = [{ name: '=cmd|calc', quantity: 2, unitPrice: 1000, taxRate: 10 }, { name: '日本語, "品名"', quantity: 1, unitPrice: 500, taxRate: 8 }]
  it('BOM付きUTF-8で日本語ヘッダを含む', () => {
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量,単価(税抜)')
    expect(csv).toContain('"日本語, ""品名"""')
  })
  it('式として解釈される先頭文字を無害化する', () => {
    expect(buildInvoiceCsv(inv)).toContain("'=cmd|calc")
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvFileName({ ...inv, invoiceNumber: '請求書-1' })).toBe('invoice--1-2026-11-07.csv')
    expect(csvFileName(inv)).toMatch(/^[A-Za-z0-9_.-]+$/)
  })
  it('JSON往復で内容が保たれ、BOM付きも読める', () => {
    const back = parseInvoiceJson('﻿' + invoiceToJson(inv), '2026-11-07')
    expect(back?.items).toEqual(inv.items)
    expect(back?.invoiceNumber).toBe('INV-0042')
  })
  it('不正なJSONは null、型の崩れた値は補正', () => {
    expect(parseInvoiceJson('not json', 'x')).toBeNull()
    expect(sanitizeInvoice({ items: 'x' }, 'x')).toBeNull()
    const s = sanitizeInvoice({ items: [{ name: 5, quantity: 'a', unitPrice: null, taxRate: 3 }], rounding: 'zzz' }, '2026-01-01')
    expect(s?.items[0]).toEqual({ name: '', quantity: 0, unitPrice: 0, taxRate: 10 })
    expect(s?.rounding).toBe('floor')
    const big = sanitizeInvoice({ items: [{ name: 'x', quantity: 1, unitPrice: 1e30, taxRate: 10 }] }, '2026-01-01')
    expect(big?.items[0].unitPrice).toBe(0)
  })
})
