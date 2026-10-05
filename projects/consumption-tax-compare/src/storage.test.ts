import { describe, expect, it } from 'vitest'
import { emptyInput } from './calc'
import { buildResultsCsv } from './csv'
import { compute } from './calc'
import { parseInput, parseInputFromJsonText } from './storage'

describe('storage: インポート検証', () => {
  it('往復（JSON化→パース）で同じ内容になる', () => {
    const input = { ...emptyInput(2028), baseYearSalesYen: 7_000_000, sales10: [1, 2, 3, 4, 5, 6] }
    expect(parseInputFromJsonText(JSON.stringify(input))).toEqual(input)
  })
  it('先頭にBOMがあっても読める', () => {
    expect(parseInputFromJsonText('﻿' + JSON.stringify(emptyInput(2027))).year).toBe(2027)
  })
  it('不正な形式はエラーにする', () => {
    expect(() => parseInputFromJsonText('not json')).toThrow('JSON')
    expect(() => parseInput(null)).toThrow()
    expect(() => parseInput({ ...emptyInput(), year: 1999 })).toThrow('year')
    expect(() => parseInput({ ...emptyInput(), sales10: [1, 2] })).toThrow('6要素')
    expect(() => parseInput({ ...emptyInput(), purchases10: '5' })).toThrow('purchases10')
  })
})

describe('csv', () => {
  it('BOM付きで日本語ヘッダー・年分を含み、文字化け文字を含まない', () => {
    const input = emptyInput(2027)
    const csv = buildResultsCsv(input, compute(input))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('2027年分')
    expect(csv).toContain('合計(円・負数は還付)')
    expect(csv).not.toContain('�')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
