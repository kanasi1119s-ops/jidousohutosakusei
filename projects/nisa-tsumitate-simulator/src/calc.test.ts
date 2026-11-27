import { describe, it, expect } from 'vitest'
import { DEFAULT_INPUT, project, requiredMonthly, simulate, validateInput, type SimulatorInput } from './calc'

const base: SimulatorInput = { ...DEFAULT_INPUT }

describe('project', () => {
  it('年利0%なら評価額は元本と一致する', () => {
    const r = project({ ...base, annualReturnPct: 0, years: 10 })
    expect(r.final.principalYen).toBe(30000 * 12 * 10)
    expect(r.final.nisaValueYen).toBeCloseTo(r.final.principalYen, 4)
    expect(r.final.taxSavedYen).toBeCloseTo(0, 4)
  })
  it('月3万円・年利4%・20年は元本720万円で評価額が約1,100万円前後になる', () => {
    const r = project(base)
    expect(r.final.principalYen).toBe(7_200_000)
    expect(r.final.nisaValueYen).toBeGreaterThan(10_000_000)
    expect(r.final.nisaValueYen).toBeLessThan(11_500_000)
    expect(r.rows).toHaveLength(20)
  })
  it('課税口座の手取りはNISA評価額以下で、差は運用益×20.315%', () => {
    const r = project(base).final
    expect(r.nisaValueYen - r.taxableNetYen).toBeCloseTo(r.gainYen * 0.20315, 4)
  })
  it('年間投資枠360万円を超える分は投資されず超過として記録される', () => {
    const r = project({ ...base, monthlyYen: 400000, years: 2 })
    expect(r.final.principalYen).toBe(7_200_000)
    expect(r.annualLimitHit).toBe(true)
    expect(r.overflowYen).toBe((400000 * 12 - 3_600_000) * 2)
  })
  it('生涯投資枠1,800万円で元本が頭打ちになる', () => {
    const r = project({ ...base, monthlyYen: 300000, years: 10 })
    expect(r.final.principalYen).toBe(18_000_000)
    expect(r.lifetimeLimitHit).toBe(true)
  })
  it('開始時の一括投資も年間枠に含まれる', () => {
    const r = project({ ...base, initialYen: 3_000_000, monthlyYen: 100000, years: 1 })
    expect(r.rows[0].principalYen).toBe(3_600_000)
  })
  it('実質価値はインフレ分だけ小さくなる', () => {
    const r = project({ ...base, inflationPct: 2 }).final
    expect(r.realValueYen).toBeCloseTo(r.nisaValueYen / Math.pow(1.02, 20), 4)
  })
  it('損失の場合は税額0', () => {
    const r = project({ ...base, annualReturnPct: -5 }).final
    expect(r.taxSavedYen).toBe(0)
    expect(r.gainYen).toBeLessThan(0)
  })
})

describe('requiredMonthly', () => {
  it('目標未設定ならnull', () => {
    expect(requiredMonthly(base)).toBeNull()
  })
  it('逆算した月額で目標に到達する', () => {
    const i = { ...base, goalYen: 20_000_000 }
    const m = requiredMonthly(i)!
    expect(project({ ...i, monthlyYen: m }).final.nisaValueYen).toBeGreaterThanOrEqual(20_000_000)
    expect(project({ ...i, monthlyYen: m - 2 }).final.nisaValueYen).toBeLessThan(20_000_000)
  })
  it('枠内では届かない目標はnull', () => {
    expect(requiredMonthly({ ...base, years: 5, goalYen: 100_000_000 })).toBeNull()
  })
})

describe('validateInput', () => {
  it('正常値はエラーなし', () => {
    expect(validateInput(base)).toEqual([])
  })
  it('負数・NaN・範囲外を検出する', () => {
    expect(validateInput({ ...base, monthlyYen: -1 })).not.toEqual([])
    expect(validateInput({ ...base, years: NaN })).not.toEqual([])
    expect(validateInput({ ...base, years: 0 })).not.toEqual([])
    expect(validateInput({ ...base, years: 2.5 })).not.toEqual([])
    expect(validateInput({ ...base, annualReturnPct: 99 })).not.toEqual([])
    expect(validateInput({ ...base, annualReturnPct: 31 })).not.toEqual([])
  })
  it('simulateは例外なく動く', () => {
    expect(simulate(base).final.year).toBe(20)
  })
})
