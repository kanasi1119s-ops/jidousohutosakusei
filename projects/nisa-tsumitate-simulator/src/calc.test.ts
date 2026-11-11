import { describe, it, expect } from 'vitest'
import { simulate, validateInput, type SimInput } from './calc'
import { buildCsv } from './csv'
import { parseInputFromJsonText } from './storage'

const base: SimInput = { account: 'adult', initialYen: 0, monthlyTsumitateYen: 50000, monthlyGrowthYen: 0, annualReturnPct: 0, years: 10 }

describe('simulate', () => {
  it('利回り0%なら評価額は元本と一致する', () => {
    const r = simulate(base)
    expect(r.finalPrincipalYen).toBe(6_000_000)
    expect(r.finalValueYen).toBeCloseTo(6_000_000, 4)
    expect(r.taxSavedYen).toBeCloseTo(0, 4)
  })
  it('プラス利回りで運用益が出て、課税口座より手取りが多い', () => {
    const r = simulate({ ...base, annualReturnPct: 5 })
    expect(r.finalGainYen).toBeGreaterThan(0)
    expect(r.taxSavedYen).toBeCloseTo(r.finalGainYen * 0.20315, 2)
  })
  it('年次行の数は期間と一致する', () => {
    expect(simulate({ ...base, years: 7 }).rows).toHaveLength(7)
  })
  it('総枠1800万円で元本が頭打ちになる', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 100000, monthlyGrowthYen: 100000, years: 30 })
    expect(r.finalPrincipalYen).toBe(18_000_000)
    expect(r.capReachedMonth).not.toBeNull()
    expect(r.capUsedRatio).toBe(1)
  })
  it('成長投資枠は1200万円まで', () => {
    const r = simulate({ ...base, monthlyTsumitateYen: 0, monthlyGrowthYen: 200000, years: 10 })
    expect(r.finalPrincipalYen).toBe(12_000_000)
  })
  it('こどもNISAは600万円まで', () => {
    const r = simulate({ ...base, account: 'child', monthlyTsumitateYen: 50000, years: 18 })
    expect(r.finalPrincipalYen).toBe(6_000_000)
  })
  it('マイナス利回りでも課税口座との差は0以下にならない', () => {
    const r = simulate({ ...base, annualReturnPct: -3 })
    expect(r.finalGainYen).toBeLessThan(0)
    expect(r.taxSavedYen).toBeCloseTo(0, 4)
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => expect(validateInput(base)).toEqual([]))
  it('積立枠の年間上限超過', () => expect(validateInput({ ...base, monthlyTsumitateYen: 100001 }).length).toBe(1))
  it('こどもNISAで成長枠はエラー', () =>
    expect(validateInput({ ...base, account: 'child', monthlyTsumitateYen: 10000, monthlyGrowthYen: 1 }).length).toBeGreaterThan(0))
  it('NaN・負数・期間不正', () => {
    expect(validateInput({ ...base, years: NaN })).toHaveLength(1)
    expect(validateInput({ ...base, initialYen: -1 }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, years: 0 }).length).toBeGreaterThan(0)
    expect(validateInput({ ...base, years: 1.5 }).length).toBeGreaterThan(0)
  })
})

describe('csv / json', () => {
  it('CSVはBOM付きで日本語ヘッダーを含む', () => {
    const csv = buildCsv(simulate(base))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('経過年数')
    expect(csv.split('\r\n').length).toBe(12)
  })
  it('JSONインポートは不正形式を拒否する', () => {
    expect(() => parseInputFromJsonText('{"years":"a"}')).toThrow()
    expect(() => parseInputFromJsonText(JSON.stringify({ ...base, account: 'x' }))).toThrow()
    expect(parseInputFromJsonText(JSON.stringify(base))).toEqual(base)
  })
})
