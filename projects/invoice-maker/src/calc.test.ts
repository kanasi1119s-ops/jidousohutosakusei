import { describe, expect, it } from 'vitest'
import { applyRounding, calcTotals, formatYen, isValidRegNo, parseNumber, withholdingTax } from './calc'
import { buildItemsCsv, safeFileName } from './csv'
import { defaultDoc, exportJson, importJson, sanitizeDoc } from './storage'

describe('parseNumber', () => {
  it('全角・カンマ・円記号を許容', () => {
    expect(parseNumber('１，２３４円')).toBe(1234)
    expect(parseNumber('¥500')).toBe(500)
    expect(parseNumber('２．５')).toBe(2.5)
  })
  it('不正値は null', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1e5')).toBeNull()
  })
})

describe('calcTotals', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    const items = [
      { name: 'a', qty: '1', unitPrice: '105', rate: 10 as const },
      { name: 'b', qty: '1', unitPrice: '105', rate: 10 as const },
    ]
    const t = calcTotals(items, 'floor', false)
    expect(t.byRate[0]).toEqual({ rate: 10, subtotal: 210, tax: 21 })
    // 行ごと切り捨てなら 10+10=20 になるはずが、合計21が正
  })
  it('10%・8%・非課税の混在', () => {
    const items = [
      { name: 'a', qty: '3', unitPrice: '1000', rate: 10 as const },
      { name: 'b', qty: '2', unitPrice: '150', rate: 8 as const },
      { name: 'c', qty: '1', unitPrice: '500', rate: 0 as const },
    ]
    const t = calcTotals(items, 'floor', false)
    expect(t.subtotal).toBe(3800)
    expect(t.tax).toBe(300 + 24)
    expect(t.total).toBe(4124)
  })
  it('端数処理モード', () => {
    expect(applyRounding(10.5, 'floor')).toBe(10)
    expect(applyRounding(10.5, 'round')).toBe(11)
    expect(applyRounding(10.1, 'ceil')).toBe(11)
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
  })
  it('小数数量と値引き行', () => {
    const items = [
      { name: 'a', qty: '1.5', unitPrice: '1000', rate: 10 as const },
      { name: 'discount', qty: '1', unitPrice: '-500', rate: 10 as const },
    ]
    expect(calcTotals(items, 'floor', false).subtotal).toBe(1000)
  })
  it('空・不正入力は0円扱いでクラッシュしない', () => {
    const t = calcTotals([{ name: '', qty: '', unitPrice: 'x', rate: 10 }], 'floor', false)
    expect(t.total).toBe(0)
    expect(t.byRate).toEqual([])
  })
  it('範囲外の巨大値は0円扱いで invalid に記録（精度劣化の防止）', () => {
    const t = calcTotals([{ name: 'x', qty: '99999999', unitPrice: '99999999', rate: 10 }], 'floor', false)
    expect(t.total).toBe(0)
    expect(t.invalid).toEqual([0])
  })
  it('源泉徴収', () => {
    expect(withholdingTax(100000)).toBe(10210)
    expect(withholdingTax(1_000_000)).toBe(102100)
    expect(withholdingTax(1_500_000)).toBe(102100 + 102100)
    expect(withholdingTax(0)).toBe(0)
    const t = calcTotals([{ name: 'a', qty: '1', unitPrice: '100000', rate: 10 }], 'floor', true)
    expect(t.withholding).toBe(10210)
    expect(t.payable).toBe(110000 - 10210)
  })
  it('formatYen', () => {
    expect(formatYen(1234567)).toBe('¥1,234,567')
    expect(formatYen(-500)).toBe('-¥500')
  })
})

describe('登録番号', () => {
  it('形式検証', () => {
    expect(isValidRegNo('T1234567890123')).toBe(true)
    expect(isValidRegNo('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegNo('t1234567890123')).toBe(true)
    expect(isValidRegNo('1234567890123')).toBe(false)
    expect(isValidRegNo('T123')).toBe(false)
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8・日本語が保持される・数式注入を無害化', () => {
    const d = defaultDoc()
    d.items = [{ name: '=HYPERLINK("x")', qty: '1', unitPrice: '1000', rate: 10 }, { name: 'デザイン費, 一式', qty: '1', unitPrice: '2000', rate: 10 }]
    const csv = buildItemsCsv(d)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量')
    expect(csv).toContain('"デザイン費, 一式"')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('合計(税込)')
    expect(csv).not.toContain('\uFFFD')
  })
  it('ファイル名は英数字のみ', () => {
    expect(safeFileName('請求書-２０２６', 'csv', '2026-11-14')).toBe('2026-2026-11-14.csv')
    expect(safeFileName('請求書', 'json', '2026-11-14')).toBe('invoice-2026-11-14.json')
    expect(safeFileName('INV/001', 'csv', '2026-11-14')).toBe('INV-001-2026-11-14.csv')
  })
})

describe('保存・インポート', () => {
  it('往復で一致', () => {
    const d = defaultDoc()
    d.clientName = '株式会社テスト'
    d.items[0].name = '開発費'
    expect(importJson(exportJson(d))).toEqual(d)
  })
  it('BOM付きJSONも読める', () => {
    expect(importJson('﻿' + exportJson(defaultDoc()))).not.toBeNull()
  })
  it('不正データは拒否・正規化', () => {
    expect(importJson('not json')).toBeNull()
    expect(importJson('{"app":"other"}')).toBeNull()
    expect(sanitizeDoc({ items: 'x' })).toBeNull()
    const d = sanitizeDoc({ items: [{ name: 5, rate: 99 }], rounding: 'zzz' })!
    expect(d.items[0].rate).toBe(10)
    expect(d.rounding).toBe('floor')
  })
})
