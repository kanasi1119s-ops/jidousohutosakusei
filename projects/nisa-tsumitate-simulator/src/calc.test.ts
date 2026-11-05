import { describe, it, expect } from 'vitest'
import { simulate, validateInput, parseNumberLoose, type SimulatorInput } from './calc'
import { buildResultsCsv, csvDownloadFileName } from './csv'
import { parseInputFromJsonText } from './storage'

const base: SimulatorInput = { initialYen: 0, tsumitateMonthlyYen: 30000, growthMonthlyYen: 0, annualReturnPercent: 0, years: 10 }

describe('simulate', () => {
  it('年利0%なら評価額=元本', () => {
    const r = simulate(base)
    expect(r.principalYen).toBe(3_600_000)
    expect(r.valueYen).toBe(3_600_000)
    expect(r.gainYen).toBe(0)
    expect(r.taxableAccountTaxYen).toBe(0)
  })
  it('年利5%・月3万円・20年で評価額が元本を上回り税額が正', () => {
    const r = simulate({ ...base, annualReturnPercent: 5, years: 20 })
    expect(r.principalYen).toBe(7_200_000)
    expect(r.valueYen).toBeGreaterThan(11_000_000)
    expect(r.valueYen).toBeLessThan(13_000_000)
    expect(r.taxableAccountTaxYen).toBe(Math.floor(r.gainYen * 0.20315))
  })
  it('生涯枠1,800万円で打ち切られる', () => {
    const r = simulate({ ...base, tsumitateMonthlyYen: 100000, growthMonthlyYen: 100000, years: 30 })
    expect(r.principalYen).toBe(18_000_000)
    expect(r.capped).toBe(true)
  })
  it('成長投資枠の生涯上限1,200万円', () => {
    const r = simulate({ ...base, tsumitateMonthlyYen: 0, growthMonthlyYen: 200000, years: 10 })
    expect(r.principalYen).toBe(12_000_000)
    expect(r.capped).toBe(true)
  })
  it('年間rowsの数が運用年数と一致', () => {
    expect(simulate(base).rows).toHaveLength(10)
  })
})

describe('validateInput', () => {
  it('つみたて枠の年間上限超過', () => {
    expect(validateInput({ ...base, tsumitateMonthlyYen: 100001 })[0]).toContain('120万円')
  })
  it('成長枠の年間上限超過（初期含む）', () => {
    expect(validateInput({ ...base, initialYen: 2_000_000, growthMonthlyYen: 40000 })[0]).toContain('240万円')
  })
  it('負数・NaN・小数年数', () => {
    expect(validateInput({ ...base, initialYen: -1 })).not.toHaveLength(0)
    expect(validateInput({ ...base, years: 1.5 })).not.toHaveLength(0)
    expect(validateInput({ ...base, years: NaN })).not.toHaveLength(0)
  })
})

describe('util', () => {
  it('全角数字を数値化', () => {
    expect(parseNumberLoose('３０，０００')).toBe(30000)
    expect(parseNumberLoose('')).toBeNaN()
    expect(parseNumberLoose('0x10')).toBeNaN()
    expect(parseNumberLoose('1e5')).toBeNaN()
    expect(parseNumberLoose('abc')).toBeNaN()
  })
  it('CSVはBOM付きで英数字ファイル名', () => {
    const csv = buildResultsCsv(simulate(base))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('経過年数')
    expect(csvDownloadFileName(new Date(2026, 10, 5))).toBe('nisa-simulation-2026-11-05.csv')
  })
  it('JSONインポートはBOMを許容し不正値を拒否', () => {
    const ok = '﻿' + JSON.stringify(base)
    expect(parseInputFromJsonText(ok).years).toBe(10)
    expect(() => parseInputFromJsonText('{"years":"x"}')).toThrow()
    expect(() => parseInputFromJsonText('not json')).toThrow()
  })
})
