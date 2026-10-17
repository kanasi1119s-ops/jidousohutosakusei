import { describe, expect, it } from 'vitest'
import {
  employmentIncomeDeduction,
  parseYenText,
  referenceTable,
  simulate,
  validateInput,
  type SimulatorInput,
} from './calc'

const base: SimulatorInput = {
  salaryYen: 5_000_000,
  socialInsuranceYen: null,
  extraDeductionYen: 0,
  donatedYen: 0,
}

describe('employmentIncomeDeduction', () => {
  it('最低保障は65万円', () => {
    expect(employmentIncomeDeduction(1_000_000)).toBe(650_000)
    expect(employmentIncomeDeduction(1_900_000)).toBe(650_000)
  })
  it('各区分の境界で連続する', () => {
    expect(employmentIncomeDeduction(3_600_000)).toBe(1_160_000)
    expect(employmentIncomeDeduction(6_600_000)).toBe(1_760_000)
    expect(employmentIncomeDeduction(8_500_000)).toBe(1_950_000)
    expect(employmentIncomeDeduction(12_000_000)).toBe(1_950_000)
  })
})

describe('simulate', () => {
  it('年収500万円・単身の目安は6万円台前半（一般的な早見表と整合）', () => {
    const r = simulate(base)
    expect(r.limitYen).toBeGreaterThanOrEqual(60_000)
    expect(r.limitYen).toBeLessThanOrEqual(62_000)
  })
  it('年収が増えると上限も増える（単調増加）', () => {
    const table = referenceTable()
    for (let i = 1; i < table.length; i++) {
      expect(table[i].limitYen).toBeGreaterThan(table[i - 1].limitYen)
    }
  })
  it('追加控除が大きいほど上限は下がる', () => {
    const a = simulate(base).limitYen
    const b = simulate({ ...base, extraDeductionYen: 760_000 }).limitYen
    expect(b).toBeLessThan(a)
  })
  it('給与0円・低収入では上限0円', () => {
    expect(simulate({ ...base, salaryYen: 0 }).limitYen).toBe(0)
    expect(simulate({ ...base, salaryYen: 1_000_000 }).limitYen).toBe(0)
  })
  it('社会保険料を手入力すると自動概算より優先される', () => {
    const auto = simulate(base)
    const manual = simulate({ ...base, socialInsuranceYen: 0 })
    expect(manual.socialInsuranceYen).toBe(0)
    expect(manual.limitYen).toBeGreaterThan(auto.limitYen)
  })
  it('寄附済み額に応じて残り枠が減り、0未満にならない', () => {
    const r = simulate({ ...base, donatedYen: 20_000 })
    expect(r.remainingYen).toBe(r.limitYen - 20_000)
    expect(simulate({ ...base, donatedYen: 99_999_999 }).remainingYen).toBe(0)
  })
  it('余裕を見た目安は上限の90%以下', () => {
    const r = simulate(base)
    expect(r.safeLimitYen).toBeLessThanOrEqual(r.limitYen * 0.9)
  })
})

describe('parseYenText', () => {
  it('全角数字・カンマ・円を許容する', () => {
    expect(parseYenText('５，０００，０００円')).toBe(5_000_000)
    expect(parseYenText(' 500,000 ')).toBe(500_000)
  })
  it('不正な文字列は NaN', () => {
    expect(parseYenText('')).toBeNaN()
    expect(parseYenText('abc')).toBeNaN()
    expect(parseYenText('-100')).toBeNaN()
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => {
    expect(validateInput(base)).toEqual([])
  })
  it('負数・NaN・巨大値を検出する', () => {
    expect(validateInput({ ...base, salaryYen: -1 })).not.toEqual([])
    expect(validateInput({ ...base, salaryYen: NaN })).not.toEqual([])
    expect(validateInput({ ...base, salaryYen: 30_000_000 })).not.toEqual([])
    expect(validateInput({ ...base, donatedYen: -5 })).not.toEqual([])
  })
})
