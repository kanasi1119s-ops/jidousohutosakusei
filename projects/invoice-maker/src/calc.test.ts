import { describe, it, expect } from 'vitest'
import { calculate, isValidRegistrationNumber, applyRounding, parseNumber, validateDoc } from './calc'
import { emptyDoc, parseDocFromJsonText, docToJsonBlob, docFileName } from './storage'
import { buildCsv } from './csv'

const base = { taxMode: 'exclusive' as const, rounding: 'floor' as const }

describe('calculate', () => {
  it('税率ごとに1回だけ端数処理する', () => {
    const t = calculate({
      ...base,
      items: [
        { name: 'a', qty: 1, unitPrice: 105, taxRate: 10 },
        { name: 'b', qty: 1, unitPrice: 105, taxRate: 10 },
        { name: 'c', qty: 1, unitPrice: 99, taxRate: 8 },
      ],
    })
    // 10%: 210 -> 21, 8%: 99 -> 7.92 -> 7 （明細ごとに処理すると 10+10 で20になり不一致）
    expect(t.byRate).toEqual([
      { rate: 10, subtotal: 210, tax: 21 },
      { rate: 8, subtotal: 99, tax: 7 },
    ])
    expect(t.total).toBe(210 + 21 + 99 + 7)
  })
  it('税込入力では内税額を逆算する', () => {
    const t = calculate({ taxMode: 'inclusive', rounding: 'floor', items: [{ name: 'a', qty: 1, unitPrice: 1100, taxRate: 10 }] })
    expect(t.tax).toBe(100)
    expect(t.subtotal).toBe(1000)
    expect(t.total).toBe(1100)
  })
  it('端数処理の方式を切り替えられる', () => {
    expect(applyRounding(0.1 * 3 * 10, 'floor')).toBe(3)
    expect(applyRounding(2.5, 'round')).toBe(3)
    expect(applyRounding(2.1, 'ceil')).toBe(3)
  })
  it('小数の数量を扱える', () => {
    const t = calculate({ ...base, items: [{ name: 'a', qty: 1.5, unitPrice: 1000, taxRate: 10 }] })
    expect(t.total).toBe(1650)
  })
  it('明細が空でも落ちない', () => {
    expect(calculate({ ...base, items: [] }).total).toBe(0)
  })
})

describe('登録番号・入力正規化', () => {
  it('T+13桁を検証する（全角・ハイフン許容）', () => {
    expect(isValidRegistrationNumber('T1234567890123')).toBe(true)
    expect(isValidRegistrationNumber('Ｔ１２３４５６７８９０１２３')).toBe(true)
    expect(isValidRegistrationNumber('T123456789012')).toBe(false)
    expect(isValidRegistrationNumber('1234567890123')).toBe(false)
  })
  it('全角数字・カンマ付きの数値を解釈する', () => {
    expect(parseNumber('１,２００円')).toBe(1200)
    expect(Number.isNaN(parseNumber('abc'))).toBe(true)
    expect(Number.isNaN(parseNumber(''))).toBe(true)
  })
})

describe('検証・入出力', () => {
  it('必須項目が空ならエラー', () => {
    expect(validateDoc(emptyDoc('2026-10-21')).length).toBeGreaterThan(0)
  })
  it('JSONの往復ができ、不正な形式は拒否する', async () => {
    const d = emptyDoc('2026-10-21')
    d.clientName = '株式会社テスト'
    const blob = docToJsonBlob(d)
    const text = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.readAsText(blob)
    })
    expect(parseDocFromJsonText('﻿' + text).clientName).toBe('株式会社テスト')
    expect(() => parseDocFromJsonText('{"a":1}')).toThrow()
  })
  it('ファイル名は英数字のみ', () => {
    const d = emptyDoc('2026-10-21')
    d.number = '請求書№12-A'
    expect(docFileName(d, 'csv')).toMatch(/^[A-Za-z0-9_.-]+$/)
  })
  it('CSVはBOM付きで数式インジェクションを無効化する', () => {
    const d = emptyDoc('2026-10-21')
    d.items[0].name = '=SUM(A1)'
    const csv = buildCsv(d)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("'=SUM(A1)")
  })
})
