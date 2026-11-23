import { describe, expect, it } from 'vitest'
import { applyRounding, calcInvoice, isValidRegistrationNumber, type Item } from './calc'
import { buildInvoicesCsv, escapeCsvField } from './csv'
import { parseNumberInput, normalizeRegNo } from './normalize'
import { parseImport, sanitizeData } from './storage'

const it10 = (q: number, p: number): Item => ({ name: 'a', qty: q, unitPrice: p, rate: 10 })
const it8 = (q: number, p: number): Item => ({ name: 'b', qty: q, unitPrice: p, rate: 8 })

describe('calc', () => {
  it('税率ごとに1回だけ端数処理する（税抜入力）', () => {
    // 33円×3行=99円 → 10% = 9.9 → 切り捨て 9（行ごとなら3円×3=9でも異なるケースの確認）
    const t = calcInvoice({ items: [it10(1, 33), it10(1, 33), it10(1, 33)], taxMode: 'exclusive', rounding: 'floor' })
    expect(t.groups).toHaveLength(1)
    expect(t.groups[0]).toMatchObject({ subtotalExcl: 99, tax: 9, totalIncl: 108 })
  })
  it('10%と8%を分けて集計する', () => {
    const t = calcInvoice({ items: [it10(2, 1000), it8(3, 500)], taxMode: 'exclusive', rounding: 'round' })
    expect(t.groups.map((g) => g.rate)).toEqual([10, 8])
    expect(t.totalTax).toBe(200 + 120)
    expect(t.grandTotal).toBe(3500 + 320)
  })
  it('税込入力では内税を逆算する', () => {
    const t = calcInvoice({ items: [it10(1, 1100), it8(1, 1080)], taxMode: 'inclusive', rounding: 'floor' })
    expect(t.groups[0]).toMatchObject({ subtotalExcl: 1000, tax: 100, totalIncl: 1100 })
    expect(t.groups[1]).toMatchObject({ subtotalExcl: 1000, tax: 80, totalIncl: 1080 })
    expect(t.grandTotal).toBe(2180)
  })
  it('小数数量の浮動小数点誤差で切り上げが狂わない', () => {
    expect(applyRounding(1.1 * 100, 'ceil')).toBe(110)
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
  })
  it('端数処理の3方式', () => {
    expect(applyRounding(10.5, 'floor')).toBe(10)
    expect(applyRounding(10.5, 'round')).toBe(11)
    expect(applyRounding(10.1, 'ceil')).toBe(11)
  })
  it('値引き(負の金額)を符号対称に処理する', () => {
    expect(applyRounding(-10.5, 'floor')).toBe(-10)
    const t = calcInvoice({ items: [it10(1, 1000), it10(1, -100)], taxMode: 'exclusive', rounding: 'floor' })
    expect(t.grandTotal).toBe(990)
  })
  it('明細なしは合計0', () => {
    expect(calcInvoice({ items: [], taxMode: 'exclusive', rounding: 'floor' }).grandTotal).toBe(0)
  })
  it('登録番号の形式検証', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('T123')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
})

describe('normalize', () => {
  it('全角数字・カンマ・円記号を解釈する', () => {
    expect(parseNumberInput('１，２３４円')).toBe(1234)
    expect(parseNumberInput('－５')).toBe(-5)
    expect(parseNumberInput('１．５')).toBe(1.5)
    expect(parseNumberInput('')).toBeNaN()
    expect(parseNumberInput('abc')).toBeNaN()
    expect(parseNumberInput('9'.repeat(200))).toBeNaN()
    expect(parseNumberInput('1000000000000')).toBe(1e12)
  })
  it('登録番号を正規化する', () => {
    expect(normalizeRegNo('ｔ１２３４-５６７８９０１２３')).toBe('T1234567890123')
  })
})

describe('csv', () => {
  it('BOM付きで日本語ヘッダーを含む', () => {
    const csv = buildInvoicesCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('請求書番号')
  })
  it('式インジェクションとカンマ・引用符をエスケープ', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvField('a,b')).toBe('"a,b"')
    expect(escapeCsvField('a"b')).toBe('"a""b"')
  })
})

describe('storage import', () => {
  const valid = { version: 1, issuer: { name: '株式会社テスト' }, invoices: [{ id: 'x', number: '1', items: [{ name: 'n', qty: 1, unitPrice: 100, rate: 10 }] }] }
  it('正しいデータを受け入れBOMも許容する', () => {
    expect(sanitizeData(valid)?.invoices).toHaveLength(1)
    expect(parseImport('﻿' + JSON.stringify(valid))?.issuer.name).toBe('株式会社テスト')
  })
  it('不正なデータを拒否する', () => {
    expect(parseImport('not json')).toBeNull()
    expect(sanitizeData({ version: 2, invoices: [] })).toBeNull()
    expect(sanitizeData({ version: 1, invoices: [{ items: [{ qty: 'x', unitPrice: 1, rate: 10 }] }] })).toBeNull()
    expect(sanitizeData({ version: 1, invoices: [{ items: [{ qty: 1, unitPrice: 1, rate: 5 }] }] })).toBeNull()
    expect(sanitizeData({ version: 1, invoices: [{ items: [{ qty: 1e300, unitPrice: 1e300, rate: 10 }] }] })).toBeNull()
  })
})
