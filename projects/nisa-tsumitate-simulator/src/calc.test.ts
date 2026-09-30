import { describe, it, expect } from 'vitest'
import { simulate, validateInput, parseNumberLoose, type SimulatorInput } from './calc'
import { buildResultsCsv } from './csv'
import { parseInputFromJsonText } from './storage'

const base: SimulatorInput = { initialYen: 0, monthlyTsumitateYen: 50000, monthlyGrowthYen: 0, annualReturnPct: 0, years: 10 }

describe('simulate', () => {
  it('利回り0%なら評価額=元本', () => {
    const r = simulate(base)
    expect(r.principalYen).toBe(6_000_000)
    expect(r.nisaFinalYen).toBeCloseTo(6_000_000)
    expect(r.taxSavedYen).toBe(0)
  })
  it('つみたて枠は年120万円で頭打ち', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 200000, years: 1 })
    expect(r.principalYen).toBe(1_200_000)
    expect(r.warnings.length).toBe(1)
  })
  it('生涯1800万円で頭打ち', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 100000, monthlyGrowthYen: 200000, years: 30 })
    expect(r.principalYen).toBe(18_000_000)
    expect(r.warnings.join('')).toContain('生涯投資枠')
  })
  it('成長投資枠の生涯上限は1200万円', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 0, monthlyGrowthYen: 200000, years: 30 })
    expect(r.principalYen).toBe(12_000_000)
  })
  it('プラス利回りで課税口座より有利', () => {
    const r = simulate({ ...base, annualReturnPct: 5 })
    expect(r.gainYen).toBeGreaterThan(0)
    expect(r.taxableFinalYen).toBeLessThan(r.nisaFinalYen)
    expect(r.taxSavedYen).toBeCloseTo(r.gainYen * 0.20315)
  })
  it('マイナス利回りでも動く', () => {
    const r = simulate({ ...base, annualReturnPct: -5 })
    expect(r.gainYen).toBeLessThan(0)
    expect(r.taxSavedYen).toBe(0)
  })
})

describe('validate / parse', () => {
  it('不正値を検出する', () => {
    expect(validateInput({ ...base, years: 0 }).length).toBe(1)
    expect(validateInput({ ...base, monthlyTsumitateYen: -1 }).length).toBe(1)
    expect(validateInput({ ...base, years: NaN }).length).toBe(1)
  })
  it('全角数字とカンマを数値化する', () => {
    expect(parseNumberLoose('５０，０００')).toBe(50000)
    expect(parseNumberLoose('')).toBeNaN()
  })
  it('JSONインポートはBOMを許容し不正形式を拒否', () => {
    const ok = JSON.stringify(base)
    expect(parseInputFromJsonText('﻿' + ok).years).toBe(10)
    expect(() => parseInputFromJsonText('{"years":"a"}')).toThrow()
    expect(() => parseInputFromJsonText('not json')).toThrow()
  })
})

describe('csv', () => {
  it('BOM付きで日本語ヘッダー', () => {
    const csv = buildResultsCsv(simulate(base))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('経過年数')
  })
})

describe('Round2 境界値', () => {
  it('巨大値でもNaNにならず枠で頭打ち', () => {
    const r = simulate({ initialYen: 1e15, monthlyTsumitateYen: 1e12, monthlyGrowthYen: 1e12, annualReturnPct: 50, years: 60 })
    expect(Number.isFinite(r.nisaFinalYen)).toBe(true)
    expect(r.principalYen).toBe(18_000_000)
  })
  it('初期投資は年240万円を超えない（超過分は投資しない）', () => {
    const r = simulate({ ...base, initialYen: 5_000_000, monthlyTsumitateYen: 0, years: 1 })
    expect(r.principalYen).toBe(2_400_000)
  })
  it('小数・空欄・全角マイナス', () => {
    expect(parseNumberLoose('５．５')).toBe(5.5)
    expect(parseNumberLoose('−３')).toBe(-3)
    expect(validateInput({ ...base, years: 5.5 }).length).toBe(1)
    expect(validateInput({ ...base, annualReturnPct: 80 }).length).toBe(1)
  })
})
