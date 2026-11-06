import { describe, expect, it } from 'vitest'
import { buildItemsCsv, safeFileStem } from './csv'
import { defaultState } from './state'

describe('buildItemsCsv', () => {
  it('BOM付きで日本語ヘッダーを含む', () => {
    const s = defaultState()
    s.items = [{ name: '制作費, 一式', quantity: 2, unitPriceYen: 5000, taxRate: 10 }]
    const csv = buildItemsCsv(s)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('品名,数量')
    expect(csv).toContain('"制作費, 一式",2,5000,10,10000')
  })
  it('数式として解釈される先頭文字を無害化する', () => {
    const s = defaultState()
    s.items = [{ name: '=HYPERLINK("x")', quantity: 1, unitPriceYen: 1, taxRate: 10 }]
    expect(buildItemsCsv(s)).toContain("\"'=HYPERLINK(\"\"x\"\")\"")
  })
})

describe('safeFileStem', () => {
  it('日本語を除去して英数字のみにする', () => {
    expect(safeFileStem('2026年11月-001')).toBe('invoice-202611-001')
    expect(safeFileStem('請求')).toBe('invoice')
  })
})
