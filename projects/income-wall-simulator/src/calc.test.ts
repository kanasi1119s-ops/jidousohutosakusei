import { describe, expect, it } from 'vitest'
import { simulate, validateInput } from './calc'
import { buildResultsCsv } from './csv'

describe('simulate', () => {
  it('計算した年収がしきい値と正しく比較される', () => {
    const result = simulate({
      hourlyWageYen: 1200,
      hoursPerWeek: 20,
      weeksPerMonth: 4.345,
      otherAnnualIncomeYen: 0,
    })
    // 1200 * 20 * 4.345 * 12 = 1,251,360円
    expect(Math.round(result.annualIncomeYen)).toBe(1251360)

    const under130 = result.results.find((r) => r.threshold.id === 'social-130')!
    expect(under130.status).toBe('under') // 130万円は下回っている（125万円強）

    const over100 = result.results.find((r) => r.threshold.id === 'resident-tax')!
    expect(over100.status).toBe('over') // 100万円は超えている
  })

  it('年収0の場合はすべてのしきい値を下回る', () => {
    const result = simulate({
      hourlyWageYen: 1000,
      hoursPerWeek: 0,
      weeksPerMonth: 4.345,
      otherAnnualIncomeYen: 0,
    })
    expect(result.annualIncomeYen).toBe(0)
    for (const r of result.results) {
      expect(r.status).toBe('under')
    }
  })

  it('週あたり上限時間の目安を計算できる', () => {
    const result = simulate({
      hourlyWageYen: 1000,
      hoursPerWeek: 10,
      weeksPerMonth: 4,
      otherAnnualIncomeYen: 0,
    })
    const threshold = result.results.find((r) => r.threshold.id === 'resident-tax')!
    // 100万円 / (1000円 * 4週 * 12ヶ月) = 20.83時間/週
    expect(threshold.maxWeeklyHoursToStayUnder).not.toBeNull()
    expect(threshold.maxWeeklyHoursToStayUnder!).toBeCloseTo(20.833, 2)
  })

  it('その他収入だけでしきい値を超える場合は上限時間が0になる', () => {
    const result = simulate({
      hourlyWageYen: 1000,
      hoursPerWeek: 5,
      weeksPerMonth: 4,
      otherAnnualIncomeYen: 2000000,
    })
    const threshold = result.results.find((r) => r.threshold.id === 'resident-tax')!
    expect(threshold.maxWeeklyHoursToStayUnder).toBe(0)
  })
})

describe('validateInput', () => {
  it('負の時給を拒否する', () => {
    const errors = validateInput({
      hourlyWageYen: -100,
      hoursPerWeek: 10,
      weeksPerMonth: 4,
      otherAnnualIncomeYen: 0,
    })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('週168時間を超える入力を拒否する', () => {
    const errors = validateInput({
      hourlyWageYen: 1000,
      hoursPerWeek: 200,
      weeksPerMonth: 4,
      otherAnnualIncomeYen: 0,
    })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('正常な入力はエラーなし', () => {
    const errors = validateInput({
      hourlyWageYen: 1000,
      hoursPerWeek: 20,
      weeksPerMonth: 4.345,
      otherAnnualIncomeYen: 0,
    })
    expect(errors).toEqual([])
  })
})

describe('buildResultsCsv (文字化け対策)', () => {
  it('先頭にBOMを付与し、日本語ヘッダーを含むCSVを生成する', () => {
    const result = simulate({
      hourlyWageYen: 1200,
      hoursPerWeek: 20,
      weeksPerMonth: 4.345,
      otherAnnualIncomeYen: 0,
    })
    const csv = buildResultsCsv(result)
    expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM
    expect(csv).toContain('しきい値名')
    expect(csv).toContain('\r\n')
  })
})
