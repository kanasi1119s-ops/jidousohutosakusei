import { describe, expect, it } from 'vitest'
import { computeEntry, computeTotals, parseAmount, validateEntry, type Entry } from './calc'
import { withholdingOf } from './rules'
import { buildCsv } from './csv'
import { parseEntriesFromJsonText } from './storage'

const base: Entry = { id: 1, label: 't', category: 'author', amountYen: 100000, taxRatePercent: 10, taxSeparated: true }

describe('withholdingOf', () => {
  it.each([
    [0, 0],
    [1, 0],
    [10000, 1021],
    [100000, 10210],
    [1_000_000, 102100],
    [1_000_001, 102100],
    [1_000_005, 102101],
    [2_000_000, 306300],
    [3_333_333, 102100 + Math.floor((2_333_333 * 2042) / 10000)],
  ])('%i円 -> %i円', (x, y) => expect(withholdingOf(x)).toBe(y))
})

describe('computeEntry', () => {
  it('消費税を区分していれば税抜額に対して源泉徴収する', () => {
    const r = computeEntry(base)
    expect(r.consumptionTaxYen).toBe(10000)
    expect(r.subjectYen).toBe(100000)
    expect(r.withholdingYen).toBe(10210)
    expect(r.paymentYen).toBe(110000 - 10210)
  })
  it('区分していなければ税込額が対象', () => {
    const r = computeEntry({ ...base, taxSeparated: false })
    expect(r.subjectYen).toBe(110000)
    expect(r.withholdingYen).toBe(11231)
  })
  it('消費税率8%・0%', () => {
    expect(computeEntry({ ...base, taxRatePercent: 8 }).consumptionTaxYen).toBe(8000)
    expect(computeEntry({ ...base, taxRatePercent: 0 }).billedYen).toBe(100000)
  })
  it('合計', () => {
    const t = computeTotals([computeEntry(base), computeEntry(base)])
    expect(t.withholdingYen).toBe(20420)
  })
})

describe('parseAmount', () => {
  it('全角数字・カンマ・円を許容', () => {
    expect(parseAmount('１２３，４５６円')).toBe(123456)
    expect(parseAmount(' 1,000 ')).toBe(1000)
  })
  it.each(['', 'abc', '-5', '1.5', '1e3'])('不正値 %s は null', (s) => expect(parseAmount(s)).toBeNull())
})

describe('validateEntry', () => {
  it('0円・過大値・不正税率を拒否', () => {
    const { id: _id, ...d } = base
    expect(validateEntry({ ...d, amountYen: 0 })).not.toHaveLength(0)
    expect(validateEntry({ ...d, amountYen: 1e12 })).not.toHaveLength(0)
    expect(validateEntry({ ...d, taxRatePercent: 5 })).not.toHaveLength(0)
    expect(validateEntry(d)).toHaveLength(0)
  })
})

describe('csv / json', () => {
  it('CSVはBOM付きで数式インジェクションを無効化する', () => {
    const r = computeEntry({ ...base, label: '=SUM(A1)' })
    const csv = buildCsv([r], computeTotals([r]))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain('項目名')
  })
  it('JSON往復とBOM除去、不正形式の拒否', () => {
    const text = '﻿' + JSON.stringify({ version: 1, entries: [base] })
    expect(parseEntriesFromJsonText(text)).toEqual([base])
    expect(() => parseEntriesFromJsonText('{"entries":[{"id":1}]}')).toThrow()
    expect(() => parseEntriesFromJsonText('not json')).toThrow()
  })
})
