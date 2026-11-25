import { describe, it, expect } from 'vitest'
import {
  calculate,
  salaryDeduction,
  incomeTaxBasicDeduction,
  incomeTaxRate,
  validateInput,
  type FurusatoInput,
} from './calc'

const base: FurusatoInput = {
  annualSalaryYen: 5_000_000,
  socialInsuranceYen: 750_000,
  otherDeductionsYen: 0,
  spouse: 'none',
  generalDependents: 0,
  specialDependents: 0,
  alreadyDonatedYen: 0,
}

describe('給与所得控除', () => {
  it('最低保障65万円と各区分の境界', () => {
    expect(salaryDeduction(1_000_000)).toBe(650_000)
    expect(salaryDeduction(1_625_000)).toBe(650_000)
    expect(salaryDeduction(1_800_000)).toBe(620_000)
    expect(salaryDeduction(5_000_000)).toBe(1_440_000)
    expect(salaryDeduction(10_000_000)).toBe(1_950_000)
  })
})

describe('基礎控除・税率', () => {
  it('所得区分ごとの基礎控除', () => {
    expect(incomeTaxBasicDeduction(1_000_000)).toBe(950_000)
    expect(incomeTaxBasicDeduction(3_560_000)).toBe(680_000)
    expect(incomeTaxBasicDeduction(8_000_000)).toBe(580_000)
  })
  it('所得税率の境界', () => {
    expect(incomeTaxRate(1_950_000)).toBe(0.05)
    expect(incomeTaxRate(1_951_000)).toBe(0.1)
    expect(incomeTaxRate(9_000_000)).toBe(0.23)
  })
})

describe('控除上限額', () => {
  it('年収500万円・独身・社保75万円は約61,000円（手計算と一致）', () => {
    const r = calculate(base)
    expect(r.residentTaxIncomePortionYen).toBe(235_500)
    expect(r.incomeTaxRate).toBe(0.1)
    expect(r.limitYen).toBe(61_000)
    expect(r.safeLimitYen).toBe(54_000)
  })
  it('社保を空欄にすると15%で概算する', () => {
    const r = calculate({ ...base, socialInsuranceYen: null })
    expect(r.socialInsuranceYen).toBe(750_000)
    expect(r.limitYen).toBe(61_000)
  })
  it('扶養が増えると上限額は下がる', () => {
    const a = calculate(base).limitYen
    const b = calculate({ ...base, spouse: 'deduction' }).limitYen
    const c = calculate({ ...base, spouse: 'deduction', specialDependents: 1 }).limitYen
    expect(b).toBeLessThan(a)
    expect(c).toBeLessThan(b)
  })
  it('年収が高いほど上限額は大きい（単調性）', () => {
    let prev = -1
    for (let s = 1_000_000; s <= 20_000_000; s += 500_000) {
      const l = calculate({ ...base, annualSalaryYen: s, socialInsuranceYen: null }).limitYen
      expect(l).toBeGreaterThanOrEqual(prev)
      prev = l
    }
  })
  it('課税所得がゼロなら上限は0円', () => {
    expect(calculate({ ...base, annualSalaryYen: 1_000_000 }).limitYen).toBe(0)
  })
  it('寄附済み額を引いた残りを返す', () => {
    const r = calculate({ ...base, alreadyDonatedYen: 30_000 })
    expect(r.remainingYen).toBe(31_000)
    expect(calculate({ ...base, alreadyDonatedYen: 70_000 }).remainingYen).toBe(-9_000)
  })
})

describe('入力検証', () => {
  it('正常値はエラーなし', () => {
    expect(validateInput(base)).toEqual([])
  })
  it('不正値を検出する', () => {
    expect(validateInput({ ...base, annualSalaryYen: 0, socialInsuranceYen: null }).length).toBe(1)
    expect(validateInput({ ...base, annualSalaryYen: NaN, socialInsuranceYen: null }).length).toBe(1)
    expect(validateInput({ ...base, annualSalaryYen: 99_000_000, socialInsuranceYen: null }).length).toBe(1)
    expect(validateInput({ ...base, generalDependents: 1.5 }).length).toBe(1)
    expect(validateInput({ ...base, socialInsuranceYen: 9_000_000 }).length).toBe(1)
    expect(validateInput({ ...base, alreadyDonatedYen: -1 }).length).toBe(1)
    expect(validateInput({ ...base, otherDeductionsYen: 1e12 }).length).toBe(1)
    expect(validateInput({ ...base, alreadyDonatedYen: 1e12 }).length).toBe(1)
  })
})

import { parseNumberField } from './parse'
describe('数値入力の解釈', () => {
  it('全角・カンマ・円記号を許容する', () => {
    expect(parseNumberField('５，０００，０００')).toBe(5_000_000)
    expect(parseNumberField('500万')).toBeNaN()
    expect(parseNumberField('¥1,234円')).toBe(1234)
    expect(parseNumberField('  ')).toBeNull()
    expect(parseNumberField('-5')).toBeNaN()
  })
})
