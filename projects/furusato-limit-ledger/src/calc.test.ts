import { describe, it, expect } from 'vitest'
import { calculateLimit, salaryIncomeDeduction, validateInput, type LimitInput } from './calc'

const base: LimitInput = { salaryYen: 5_000_000, socialInsuranceYen: null, spouse: 'none', generalDependents: 0, specialDependents: 0, otherDeductionYen: 0 }

describe('給与所得控除（2025年分以降）', () => {
  it('低所得の最低保障は65万円', () => { expect(salaryIncomeDeduction(1_000_000)).toBe(650_000) })
  it('500万円は144万円', () => { expect(salaryIncomeDeduction(5_000_000)).toBe(1_440_000) })
  it('850万円超は195万円で頭打ち', () => { expect(salaryIncomeDeduction(20_000_000)).toBe(1_950_000) })
})

describe('控除上限額', () => {
  it('年収500万円・独身は約6万円台', () => {
    const r = calculateLimit(base)
    expect(r.limitYen).toBeGreaterThanOrEqual(60_000)
    expect(r.limitYen).toBeLessThanOrEqual(63_000)
  })
  it('年収が高いほど上限額も増える', () => {
    expect(calculateLimit({ ...base, salaryYen: 8_000_000 }).limitYen).toBeGreaterThan(calculateLimit(base).limitYen)
  })
  it('配偶者・扶養がいると上限額は下がる', () => {
    const a = calculateLimit(base).limitYen
    expect(calculateLimit({ ...base, spouse: 'deduction' }).limitYen).toBeLessThan(a)
    expect(calculateLimit({ ...base, specialDependents: 1 }).limitYen).toBeLessThan(a)
  })
  it('給与収入が低く所得割が0なら上限は0円', () => {
    expect(calculateLimit({ ...base, salaryYen: 1_000_000 }).limitYen).toBe(0)
  })
  it('上限は1,000円単位に切り捨て', () => { expect(calculateLimit(base).limitYen % 1000).toBe(0) })
  it('社会保険料を明示すると反映される', () => {
    expect(calculateLimit({ ...base, socialInsuranceYen: 0 }).limitYen).toBeGreaterThan(calculateLimit(base).limitYen)
  })
})

describe('入力検証', () => {
  it('負数はエラー', () => { expect(validateInput({ ...base, salaryYen: -1 })).toHaveLength(1) })
  it('NaNはエラー', () => { expect(validateInput({ ...base, salaryYen: NaN }).length).toBeGreaterThan(0) })
  it('正常値はエラーなし', () => { expect(validateInput(base)).toEqual([]) })
})

describe('総務省の目安表との整合（独身・給与収入のみ）', () => {
  it.each([[3_000_000, 28_000], [4_000_000, 42_000], [5_000_000, 61_000], [7_000_000, 108_000]])('年収%i円は約%i円', (salary, expected) => {
    expect(calculateLimit({ ...base, salaryYen: salary }).limitYen).toBe(expected)
  })
  it('極端に大きい値でもNaNにならない', () => {
    const r = calculateLimit({ ...base, salaryYen: 900_000_000 })
    expect(Number.isFinite(r.limitYen)).toBe(true)
  })
  it('小数の入力は切り捨てて扱う', () => { expect(calculateLimit({ ...base, salaryYen: 5_000_000.9 }).limitYen).toBe(61_000) })
})
