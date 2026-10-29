import { describe, expect, it } from 'vitest'
import { salaryDeduction, simulate, validateInput, incomeTaxRate, type SimulatorInput } from './calc'
import { buildResultsCsv } from './csv'
import { parseInputFromJsonText } from './storage'

const base: SimulatorInput = {
  salaryYen: 5_000_000,
  socialInsuranceYen: null,
  spouse: 'none',
  dependents: 0,
  specialDependents: 0,
}

describe('給与所得控除', () => {
  it('最低保障額が適用される', () => {
    expect(salaryDeduction(1_000_000)).toBe(740_000)
    expect(salaryDeduction(500_000)).toBe(500_000)
  })
  it('各区分の式で計算される', () => {
    expect(salaryDeduction(3_000_000)).toBe(980_000)
    expect(salaryDeduction(5_000_000)).toBe(1_440_000)
    expect(salaryDeduction(10_000_000)).toBe(1_950_000)
  })
})

describe('simulate', () => {
  it('年収500万円・独身の上限額が妥当な範囲(約5〜7万円台)に収まる', () => {
    const r = simulate(base)
    expect(r.limitYen).toBeGreaterThan(50_000)
    expect(r.limitYen).toBeLessThan(80_000)
  })
  it('年収が上がると上限額が増える（単調増加）', () => {
    let prev = -1
    for (let s = 2_000_000; s <= 20_000_000; s += 500_000) {
      const l = simulate({ ...base, salaryYen: s }).limitYen
      expect(l).toBeGreaterThanOrEqual(prev)
      prev = l
    }
  })
  it('配偶者控除・扶養親族がいると上限額が下がる', () => {
    const single = simulate(base).limitYen
    expect(simulate({ ...base, spouse: 'deduction' }).limitYen).toBeLessThan(single)
    expect(simulate({ ...base, dependents: 2 }).limitYen).toBeLessThan(single)
    expect(simulate({ ...base, specialDependents: 1 }).limitYen).toBeLessThan(single)
  })
  it('収入が小さく住民税所得割がゼロなら上限は0円', () => {
    expect(simulate({ ...base, salaryYen: 1_000_000 }).limitYen).toBe(0)
    expect(simulate({ ...base, salaryYen: 0 }).limitYen).toBe(0)
  })
  it('社会保険料を明示すると概算より上限が変わる', () => {
    const auto = simulate(base).limitYen
    const low = simulate({ ...base, socialInsuranceYen: 300_000 }).limitYen
    expect(low).toBeGreaterThan(auto)
  })
  it('上限額は100円単位に丸められる', () => {
    expect(simulate(base).limitYen % 100).toBe(0)
  })
})

describe('incomeTaxRate', () => {
  it('境界値', () => {
    expect(incomeTaxRate(1_950_000)).toBe(0.05)
    expect(incomeTaxRate(1_950_001)).toBe(0.1)
    expect(incomeTaxRate(50_000_000)).toBe(0.45)
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => expect(validateInput(base)).toEqual([]))
  it('不正値を検出する', () => {
    expect(validateInput({ ...base, salaryYen: -1 }).length).toBe(1)
    expect(validateInput({ ...base, salaryYen: NaN }).length).toBe(1)
    expect(validateInput({ ...base, dependents: 1.5 }).length).toBe(1)
    expect(validateInput({ ...base, socialInsuranceYen: -5 }).length).toBe(1)
  })
})

describe('CSV / JSON', () => {
  it('CSVはBOM付きで日本語ヘッダーを含む', () => {
    const csv = buildResultsCsv(simulate(base))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('ふるさと納税 控除上限額の目安')
  })
  it('JSONインポートはBOMを許容し不正形式を拒否する', () => {
    const ok = parseInputFromJsonText('﻿' + JSON.stringify(base))
    expect(ok.salaryYen).toBe(5_000_000)
    expect(() => parseInputFromJsonText('{"salaryYen":1}')).toThrow()
    expect(() => parseInputFromJsonText('not json')).toThrow()
  })
})
