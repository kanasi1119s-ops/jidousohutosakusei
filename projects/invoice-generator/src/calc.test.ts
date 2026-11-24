import { describe, expect, it } from 'vitest'
import { calcTotals, isValidRegistrationNumber, normalizeRegistrationNumber, parseNumberInput, applyRounding } from './calc'
import { buildInvoiceCsv, escapeCsvField, safeFileName } from './csv'
import { checkInvoice, emptyInvoice, emptyIssuer, parseAppData } from './model'

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    // 税抜 333円 x 3行 = 999円 → 10% = 99.9 → 切り捨て 99
    const items = [1, 2, 3].map(() => ({ description: 'a', quantity: 1, unitPriceYen: 333, taxRate: 10 as const }))
    const t = calcTotals(items, 'floor')
    expect(t.byRate).toEqual([{ taxRate: 10, subtotalYen: 999, taxYen: 99 }])
    expect(t.totalYen).toBe(1098)
  })
  it('10%と8%を区分する', () => {
    const t = calcTotals(
      [
        { description: 'a', quantity: 2, unitPriceYen: 1000, taxRate: 10 },
        { description: 'b', quantity: 1, unitPriceYen: 500, taxRate: 8 },
      ],
      'round',
    )
    expect(t.byRate.map((r) => [r.taxRate, r.subtotalYen, r.taxYen])).toEqual([[10, 2000, 200], [8, 500, 40]])
    expect(t.totalYen).toBe(2740)
  })
  it('端数処理の方式を切り替えられる', () => {
    const items = [{ description: 'a', quantity: 1, unitPriceYen: 105, taxRate: 10 as const }]
    expect(calcTotals(items, 'floor').taxYen).toBe(10)
    expect(calcTotals(items, 'round').taxYen).toBe(11)
    expect(calcTotals(items, 'ceil').taxYen).toBe(11)
  })
  it('小数数量でも浮動小数点誤差が出ない', () => {
    expect(applyRounding(0.1 + 0.2, 'floor')).toBe(0)
    const t = calcTotals([{ description: 'a', quantity: 0.1, unitPriceYen: 3, taxRate: 10 }], 'floor')
    expect(t.subtotalYen).toBe(0)
  })
  it('空の明細は0円', () => {
    expect(calcTotals([], 'floor').totalYen).toBe(0)
  })
})

describe('入力の正規化', () => {
  it('全角数字・カンマを数値化', () => {
    expect(parseNumberInput('１，２３４')).toBe(1234)
    expect(parseNumberInput('１２．５')).toBe(12.5)
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('')).toBeNaN()
  })
  it('登録番号の形式', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T-1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(normalizeRegistrationNumber(' t1234567890123 ')).toBe('T1234567890123')
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で日本語を含む', () => {
    const inv = emptyInvoice('2026-11-24')
    inv.clientName = '株式会社テスト'
    inv.items = [{ description: 'デザイン費, 一式', quantity: 1, unitPriceYen: 10000, taxRate: 10 }]
    const csv = buildInvoiceCsv(inv)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('株式会社テスト')
    expect(csv).toContain('"デザイン費, 一式"')
    expect(csv).not.toContain('\uFFFD')
  })
  it('数式インジェクションを無効化', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvField('通常')).toBe('通常')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('invoice', 'csv', new Date(2026, 10, 24))).toBe('invoice-2026-11-24.csv')
  })
})

describe('model', () => {
  it('必須項目不足を検出', () => {
    const inv = emptyInvoice('2026-11-24')
    const p = checkInvoice(emptyIssuer(), inv)
    expect(p.some((x) => x.field === 'issuer.reg')).toBe(true)
    expect(p.some((x) => x.field === 'client')).toBe(true)
  })
  it('巨大金額・期限逆転・数量0を検出', () => {
    const issuer = { ...emptyIssuer(), name: 'a', registrationNumber: 'T1234567890123' }
    const inv = emptyInvoice('2026-11-24')
    inv.clientName = 'c'
    inv.dueDate = '2026-11-01'
    inv.items = [{ description: 'x', quantity: 0, unitPriceYen: 1, taxRate: 10 }, { description: 'y', quantity: 1, unitPriceYen: 1e15, taxRate: 10 }]
    const msgs = checkInvoice(issuer, inv).map((x) => x.message).join('|')
    expect(msgs).toContain('支払期限')
    expect(msgs).toContain('数量')
    expect(msgs).toContain('大きすぎ')
  })
  it('バックアップの往復とBOM除去、不正データ拒否', () => {
    const data = { version: 1, issuer: { ...emptyIssuer(), name: '山田商店', registrationNumber: 'T1234567890123' }, invoices: [emptyInvoice('2026-11-24')] }
    const text = '﻿' + JSON.stringify(data)
    expect(parseAppData(text).issuer.name).toBe('山田商店')
    expect(() => parseAppData('{')).toThrow()
    expect(() => parseAppData('{"version":2}')).toThrow()
    expect(() => parseAppData(JSON.stringify({ ...data, invoices: [{ id: 1 }] }))).toThrow()
  })
})
