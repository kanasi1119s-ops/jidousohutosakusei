import { describe, it, expect } from 'vitest'
import { simulate, validateInput, parseNumber, LIMITS, type NisaInput } from './calc'
import { buildResultsCsv, csvDownloadFileName } from './csv'
import { parseInput } from './storage'

const base: NisaInput = { initialPrincipalYen: 0, monthlyTsumitateYen: 50000, annualGrowthYen: 0, annualReturnPct: 0, feePct: 0, years: 10 }

describe('simulate', () => {
  it('利回り0%なら評価額=元本', () => {
    const r = simulate(base)
    expect(r.final.principalYen).toBe(6_000_000)
    expect(r.final.valueYen).toBe(6_000_000)
    expect(r.final.taxSavedYen).toBe(0)
  })
  it('利回りがあると評価額が元本を上回り非課税メリットが出る', () => {
    const r = simulate({ ...base, annualReturnPct: 3 })
    expect(r.final.valueYen).toBeGreaterThan(r.final.principalYen)
    expect(r.final.taxSavedYen).toBeGreaterThan(0)
    expect(r.taxableValueYen).toBeLessThan(r.final.valueYen)
  })
  it('生涯投資枠1800万円で打ち止めになる', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 100000, annualGrowthYen: 2_400_000, years: 20 })
    expect(r.final.principalYen).toBe(LIMITS.lifetimeYen)
    expect(r.final.limitReached).toBe(true)
  })
  it('成長投資枠は生涯1200万円まで', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 0, annualGrowthYen: 2_400_000, years: 10 })
    expect(r.final.principalYen).toBe(LIMITS.lifetimeGrowthYen)
  })
  it('費用を引くと評価額が下がる', () => {
    const a = simulate({ ...base, annualReturnPct: 5 })
    const b = simulate({ ...base, annualReturnPct: 5, feePct: 1 })
    expect(b.final.valueYen).toBeLessThan(a.final.valueYen)
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => expect(validateInput(base)).toEqual([]))
  it('つみたて月10万円超はエラー', () => expect(validateInput({ ...base, monthlyTsumitateYen: 100001 }).length).toBe(1))
  it('成長枠240万円超はエラー', () => expect(validateInput({ ...base, annualGrowthYen: 2_400_001 }).length).toBe(1))
  it('NaNと負数と小数年数はエラー', () => {
    expect(validateInput({ ...base, years: NaN }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, monthlyTsumitateYen: -1 }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, years: 2.5 }).length).toBeGreaterThan(0)
  })
})

describe('parseNumber', () => {
  it('全角数字とカンマを正規化する', () => {
    expect(parseNumber('５０，０００')).toBe(50000)
    expect(parseNumber('3．５')).toBe(3.5)
    expect(parseNumber('')).toBeNaN()
  })
})

describe('csv/storage', () => {
  it('CSVはBOM付きで日本語ヘッダーを持つ', () => {
    const csv = buildResultsCsv(simulate(base))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('経過年')
  })
  it('ファイル名は英数字のみ', () => expect(csvDownloadFileName(new Date(2026, 9, 13))).toBe('nisa-simulation-2026-10-13.csv'))
  it('JSONインポートは不正形式を拒否しBOMを許容する', () => {
    expect(() => parseInput('{"years":"x"}')).toThrow()
    expect(parseInput('﻿' + JSON.stringify(base)).years).toBe(10)
  })
})
