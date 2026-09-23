import { describe, expect, it } from 'vitest'
import {
  calcEmploymentIncomeDeduction,
  findNationalTaxRate,
  simulate,
} from '../calc'

describe('calcEmploymentIncomeDeduction', () => {
  it('returns 0 for non-positive income', () => {
    expect(calcEmploymentIncomeDeduction(0)).toBe(0)
    expect(calcEmploymentIncomeDeduction(-100)).toBe(0)
  })

  it('uses the flat 550,000 band for low income', () => {
    expect(calcEmploymentIncomeDeduction(1000000)).toBe(550000)
    expect(calcEmploymentIncomeDeduction(1625000)).toBe(550000)
  })

  it('caps at 1,950,000 for high income', () => {
    expect(calcEmploymentIncomeDeduction(10000000)).toBe(1950000)
    expect(calcEmploymentIncomeDeduction(8500001)).toBe(1950000)
  })

  it('matches the 660万-850万 band formula', () => {
    expect(calcEmploymentIncomeDeduction(7000000)).toBe(1800000)
  })
})

describe('findNationalTaxRate', () => {
  it('picks the correct progressive bracket', () => {
    expect(findNationalTaxRate(1000000)).toBe(0.05)
    expect(findNationalTaxRate(1950000)).toBe(0.05)
    expect(findNationalTaxRate(1950001)).toBe(0.1)
    expect(findNationalTaxRate(3300000)).toBe(0.1)
    expect(findNationalTaxRate(6950000)).toBe(0.2)
    expect(findNationalTaxRate(9000000)).toBe(0.23)
    expect(findNationalTaxRate(18000000)).toBe(0.33)
    expect(findNationalTaxRate(40000000)).toBe(0.4)
    expect(findNationalTaxRate(50000000)).toBe(0.45)
  })
})

describe('simulate', () => {
  it('never returns a negative donation limit', () => {
    const result = simulate({ annualIncome: 0, familyType: 'single' })
    expect(result.donationLimit).toBe(0)
  })

  it('is monotonically non-decreasing in income for the same family type', () => {
    const low = simulate({ annualIncome: 3000000, familyType: 'single' })
    const mid = simulate({ annualIncome: 5000000, familyType: 'single' })
    const high = simulate({ annualIncome: 8000000, familyType: 'single' })
    expect(mid.donationLimit).toBeGreaterThanOrEqual(low.donationLimit)
    expect(high.donationLimit).toBeGreaterThanOrEqual(mid.donationLimit)
  })

  it('gives a single filer a higher (or equal) limit than an otherwise identical filer with dependents', () => {
    const single = simulate({ annualIncome: 6000000, familyType: 'single' })
    const withFamily = simulate({
      annualIncome: 6000000,
      familyType: 'spouse_no_income_child2_hs_univ',
    })
    expect(single.donationLimit).toBeGreaterThanOrEqual(withFamily.donationLimit)
  })

  it('rounds the donation limit down to the nearest 100 yen', () => {
    const result = simulate({ annualIncome: 5000000, familyType: 'single' })
    expect(result.donationLimit % 100).toBe(0)
  })

  it('produces a plausible order-of-magnitude result for a common reference case (single, 5,000,000 yen)', () => {
    // 各ポータルサイトの早見表では概ね5万円台後半〜6万円台前半とされるケース。
    // 本ツールの簡易モデルでも同程度の範囲に収まることを確認する（厳密一致は保証しない）。
    const result = simulate({ annualIncome: 5000000, familyType: 'single' })
    expect(result.donationLimit).toBeGreaterThan(30000)
    expect(result.donationLimit).toBeLessThan(90000)
  })

  it('handles a negative income input by treating it as having no positive result', () => {
    const result = simulate({ annualIncome: -1000000, familyType: 'single' })
    expect(result.donationLimit).toBe(0)
  })

  it('does not crash or overflow for an extremely large income (boundary/異常値)', () => {
    const result = simulate({ annualIncome: 999999999999, familyType: 'single' })
    expect(Number.isFinite(result.donationLimit)).toBe(true)
    expect(result.donationLimit).toBeGreaterThan(0)
  })

  it('is deterministic across repeated calls with the same input (double operation)', () => {
    const a = simulate({ annualIncome: 5000000, familyType: 'single' })
    const b = simulate({ annualIncome: 5000000, familyType: 'single' })
    expect(a).toEqual(b)
  })
})
