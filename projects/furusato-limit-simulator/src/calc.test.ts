import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUT, buildQuickTable, incomeTaxRateFor, parseYen, salaryDeduction, simulate } from './calc'
import { buildResultsCsv, csvDownloadFileName, escapeCsvField } from './csv'
import { parseInputFromJsonText, inputToJsonBlob } from './storage'

describe('salaryDeduction', () => {
  it('最低保障額・境界・上限', () => {
    expect(salaryDeduction(1_000_000)).toBe(650_000)
    expect(salaryDeduction(1_625_000)).toBe(650_000)
    expect(salaryDeduction(5_000_000)).toBe(1_440_000)
    expect(salaryDeduction(10_000_000)).toBe(1_950_000)
  })
})

describe('incomeTaxRateFor', () => {
  it('税率区分', () => {
    expect(incomeTaxRateFor(1_950_000)).toBe(0.05)
    expect(incomeTaxRateFor(1_951_000)).toBe(0.1)
    expect(incomeTaxRateFor(50_000_000)).toBe(0.45)
  })
})

describe('simulate', () => {
  it('年収500万円・独身は一般的な目安(6万円台前半)に収まる', () => {
    const r = simulate({ ...DEFAULT_INPUT, salaryYen: 5_000_000 })
    expect(r.limitYen).toBeGreaterThan(55_000)
    expect(r.limitYen).toBeLessThan(70_000)
    expect(r.safeLimitYen).toBeLessThan(r.limitYen)
  })
  it('年収が高いほど上限は単調に増える', () => {
    const t = buildQuickTable(DEFAULT_INPUT)
    for (let i = 1; i < t.length; i++) expect(t[i].limitYen).toBeGreaterThan(t[i - 1].limitYen)
  })
  it('配偶者控除・扶養が増えると上限は下がる', () => {
    const base = simulate({ ...DEFAULT_INPUT, salaryYen: 6_000_000 }).limitYen
    expect(simulate({ ...DEFAULT_INPUT, salaryYen: 6_000_000, spouse: 'spouse' }).limitYen).toBeLessThan(base)
    expect(simulate({ ...DEFAULT_INPUT, salaryYen: 6_000_000, dependentsSpecific: 1 }).limitYen).toBeLessThan(base)
  })
  it('住宅ローン控除で上限が下がる', () => {
    const base = simulate({ ...DEFAULT_INPUT, salaryYen: 6_000_000 }).limitYen
    expect(simulate({ ...DEFAULT_INPUT, salaryYen: 6_000_000, housingLoanResidentTaxYen: 50_000 }).limitYen).toBeLessThan(base)
  })
  it('年収0・非常に低い年収では0円', () => {
    expect(simulate({ ...DEFAULT_INPUT, salaryYen: 0 }).limitYen).toBe(0)
    expect(simulate({ ...DEFAULT_INPUT, salaryYen: 1_000_000 }).limitYen).toBe(0)
  })
  it('異常値（NaN・負数・巨大値）でも落ちない', () => {
    const r = simulate({ ...DEFAULT_INPUT, salaryYen: NaN, dependentsGeneral: -5, otherDeductionsYen: 1e30 })
    expect(Number.isFinite(r.limitYen)).toBe(true)
    expect(simulate({ ...DEFAULT_INPUT, salaryYen: 1e15 }).limitYen).toBeGreaterThan(0)
  })
  it('寄附予定額の判定', () => {
    const lim = simulate(DEFAULT_INPUT).limitYen
    expect(simulate({ ...DEFAULT_INPUT, plannedDonationYen: lim }).donationStatus).toBe('within')
    const over = simulate({ ...DEFAULT_INPUT, plannedDonationYen: lim + 10_000 })
    expect(over.donationStatus).toBe('over')
    expect(over.estimatedSelfBurdenYen).toBe(12_000)
  })
})

describe('parseYen', () => {
  it('全角数字・カンマ・円を許容', () => {
    expect(parseYen('５，０００，０００円')).toBe(5_000_000)
    expect(parseYen(' 1,200 ')).toBe(1200)
  })
  it('不正値はnull', () => {
    expect(parseYen('abc')).toBeNull()
    expect(parseYen('-5')).toBeNull()
    expect(parseYen('1.5')).toBeNull()
    expect(parseYen('')).toBeNull()
  })
})

describe('CSV', () => {
  it('BOM付きUTF-8で日本語を含む', () => {
    const csv = buildResultsCsv(DEFAULT_INPUT, simulate(DEFAULT_INPUT))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('控除上限額の目安(円)')
    expect(csv).toContain('\r\n')
  })
  it('式として解釈される先頭文字を無害化', () => {
    expect(escapeCsvField('=1+1')).toBe("'=1+1")
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })
  it('ファイル名は英数字のみ', () => {
    expect(csvDownloadFileName(new Date(2026, 10, 28))).toBe('furusato-limit-2026-11-28.csv')
  })
})

describe('JSON import/export', () => {
  it('往復で一致', async () => {
    const input = { ...DEFAULT_INPUT, salaryYen: 7_000_000, spouse: 'spouse' as const }
    const blob = inputToJsonBlob(input)
    const text = await new Promise<string>((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.readAsText(blob)
    })
    expect(parseInputFromJsonText(text)).toEqual(input)
  })
  it('BOM付きでも読める', () => {
    expect(parseInputFromJsonText('﻿' + JSON.stringify(DEFAULT_INPUT)).salaryYen).toBe(DEFAULT_INPUT.salaryYen)
  })
  it('不正な形式は例外', () => {
    expect(() => parseInputFromJsonText('not json')).toThrow()
    expect(() => parseInputFromJsonText('{"salaryYen":"x"}')).toThrow()
    expect(() => parseInputFromJsonText('null')).toThrow()
  })
})
