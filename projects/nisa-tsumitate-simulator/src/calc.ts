import { NISA_LIMITS } from './limits'

export interface SimulatorInput {
  /** 開始時の一括投資額（円） */
  initialYen: number
  /** 毎月の積立額（円） */
  monthlyYen: number
  /** 想定年利（%、手数料控除後のイメージ） */
  annualReturnPct: number
  /** 運用期間（年） */
  years: number
  /** 想定インフレ率（%/年） */
  inflationPct: number
  /** 目標金額（円、0なら未設定） */
  goalYen: number
}

export interface YearRow {
  year: number
  /** NISA口座に実際に投資できた元本の累計 */
  principalYen: number
  /** NISA口座の評価額（非課税） */
  nisaValueYen: number
  /** 運用益（評価額 - 元本） */
  gainYen: number
  /** 同じ条件を課税口座で運用し、その時点で売却した場合の税引き後評価額 */
  taxableNetYen: number
  /** NISAにより非課税となる税額の目安 */
  taxSavedYen: number
  /** NISA評価額を現在価値（インフレ調整）に換算した額 */
  realValueYen: number
}

export interface SimulationResult {
  rows: YearRow[]
  final: YearRow
  /** 年間・生涯の投資枠に収まらず、NISAで投資できなかった額の合計 */
  overflowYen: number
  annualLimitHit: boolean
  lifetimeLimitHit: boolean
  /** 目標金額に届く最小の月額（目標未設定・不能時は null） */
  requiredMonthlyYen: number | null
}

export function validateInput(i: SimulatorInput): string[] {
  const errors: string[] = []
  const nums: [string, number][] = [
    ['開始時の投資額', i.initialYen],
    ['毎月の積立額', i.monthlyYen],
    ['想定年利', i.annualReturnPct],
    ['運用期間', i.years],
    ['想定インフレ率', i.inflationPct],
    ['目標金額', i.goalYen],
  ]
  for (const [name, v] of nums) {
    if (!Number.isFinite(v)) errors.push(`${name}は数値で入力してください。`)
  }
  if (errors.length > 0) return errors
  if (i.initialYen < 0) errors.push('開始時の投資額は0以上で入力してください。')
  if (i.monthlyYen < 0) errors.push('毎月の積立額は0以上で入力してください。')
  if (i.goalYen < 0) errors.push('目標金額は0以上で入力してください。')
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 60) {
    errors.push('運用期間は1〜60の整数（年）で入力してください。')
  }
  if (i.annualReturnPct < -50 || i.annualReturnPct > 30) {
    errors.push('想定年利は-50〜30（%）の範囲で入力してください。')
  }
  if (i.inflationPct < -10 || i.inflationPct > 50) {
    errors.push('想定インフレ率は-10〜50（%）の範囲で入力してください。')
  }
  if (i.initialYen > 1e11 || i.monthlyYen > 1e10 || i.goalYen > 1e13) {
    errors.push('金額が大きすぎます。')
  }
  return errors
}

function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1
}

/** 入力に基づく年次推移を計算する（目標逆算なし）。 */
export function project(i: SimulatorInput): Omit<SimulationResult, 'requiredMonthlyYen'> {
  const r = monthlyRate(i.annualReturnPct)
  const infl = i.inflationPct / 100
  let value = 0
  let principal = 0
  let overflow = 0
  let annualLimitHit = false
  let lifetimeLimitHit = false
  const rows: YearRow[] = []

  for (let y = 1; y <= i.years; y++) {
    let investedThisYear = 0
    const invest = (wanted: number): number => {
      if (wanted <= 0) return 0
      const annualRoom = NISA_LIMITS.annualYen - investedThisYear
      const lifetimeRoom = NISA_LIMITS.lifetimeYen - principal
      const allowed = Math.max(0, Math.min(wanted, annualRoom, lifetimeRoom))
      if (allowed < wanted) {
        if (annualRoom < wanted && annualRoom <= lifetimeRoom) annualLimitHit = true
        if (lifetimeRoom < wanted && lifetimeRoom < annualRoom) lifetimeLimitHit = true
        overflow += wanted - allowed
      }
      investedThisYear += allowed
      principal += allowed
      return allowed
    }
    if (y === 1) value += invest(i.initialYen)
    for (let m = 0; m < 12; m++) {
      value += invest(i.monthlyYen) // 月初に積立
      value *= 1 + r
    }
    const gain = value - principal
    const tax = Math.max(0, gain) * NISA_LIMITS.taxableRate
    rows.push({
      year: y,
      principalYen: principal,
      nisaValueYen: value,
      gainYen: gain,
      taxableNetYen: value - tax,
      taxSavedYen: tax,
      realValueYen: value / Math.pow(1 + infl, y),
    })
  }
  return {
    rows,
    final: rows[rows.length - 1],
    overflowYen: overflow,
    annualLimitHit,
    lifetimeLimitHit,
  }
}

/** 目標金額（名目）に届く最小の月額を二分探索する。年間枠上限（月30万円）までを探索対象とする。 */
export function requiredMonthly(i: SimulatorInput): number | null {
  if (i.goalYen <= 0) return null
  const cap = NISA_LIMITS.annualYen / 12
  const reach = (m: number) => project({ ...i, monthlyYen: m }).final.nisaValueYen >= i.goalYen
  if (reach(0)) return 0
  if (!reach(cap)) return null
  let lo = 0
  let hi = cap
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (reach(mid)) hi = mid
    else lo = mid
  }
  return Math.ceil(hi)
}

export function simulate(i: SimulatorInput): SimulationResult {
  return { ...project(i), requiredMonthlyYen: requiredMonthly(i) }
}

export const DEFAULT_INPUT: SimulatorInput = {
  initialYen: 0,
  monthlyYen: 30000,
  annualReturnPct: 4,
  years: 20,
  inflationPct: 1,
  goalYen: 0,
}
