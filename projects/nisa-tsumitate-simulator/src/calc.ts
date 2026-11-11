import { RULES, TAXABLE_RATE, type AccountType } from './rules'

export interface SimInput {
  account: AccountType
  initialYen: number // 開始時の一括投資（成人: 成長投資枠 / こども: 積立枠で扱う）
  monthlyTsumitateYen: number
  monthlyGrowthYen: number
  annualReturnPct: number
  years: number
}

export interface YearRow {
  year: number
  principalYen: number
  valueYen: number
  gainYen: number
  taxableAfterTaxYen: number
}

export interface SimResult {
  rows: YearRow[]
  finalPrincipalYen: number
  finalValueYen: number
  finalGainYen: number
  taxableAfterTaxYen: number
  taxSavedYen: number
  capReachedMonth: number | null
  capUsedRatio: number
}

export function validateInput(i: SimInput): string[] {
  const e: string[] = []
  const r = RULES[i.account]
  const nums = [i.initialYen, i.monthlyTsumitateYen, i.monthlyGrowthYen, i.annualReturnPct, i.years]
  if (nums.some((n) => !Number.isFinite(n))) return ['数値を入力してください。']
  if (i.initialYen < 0 || i.monthlyTsumitateYen < 0 || i.monthlyGrowthYen < 0) e.push('金額は0以上で入力してください。')
  if (i.annualReturnPct < -50 || i.annualReturnPct > 30) e.push('想定利回りは-50〜30%の範囲で入力してください。')
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 60) e.push('期間は1〜60年の整数で入力してください。')
  if (i.monthlyTsumitateYen * 12 > r.annualTsumitateYen)
    e.push(`積立枠の年間上限（${r.annualTsumitateYen.toLocaleString('ja-JP')}円）を超えています。`)
  if (i.account === 'child') {
    if (i.monthlyGrowthYen > 0) e.push('こどもNISAでは成長投資枠は使えません（0にしてください）。')
    if (i.initialYen + i.monthlyTsumitateYen * 12 > r.annualTsumitateYen)
      e.push('初年度の投資額がこどもNISAの年間上限を超えています。')
  } else if (i.initialYen + i.monthlyGrowthYen * 12 > r.annualGrowthYen) {
    e.push(`初年度の成長投資枠（一括＋毎月分）が年間上限（${r.annualGrowthYen.toLocaleString('ja-JP')}円）を超えています。`)
  }
  return e
}

export function simulate(i: SimInput): SimResult {
  const r = RULES[i.account]
  const m = Math.pow(1 + i.annualReturnPct / 100, 1 / 12) - 1
  let value = 0
  let principal = 0
  let growthUsed = 0
  let capMonth: number | null = null
  const rows: YearRow[] = []

  const add = (want: number, isGrowth: boolean) => {
    let room = r.totalCapYen - principal
    if (isGrowth) room = Math.min(room, r.growthCapYen - growthUsed)
    const x = Math.max(0, Math.min(want, room))
    principal += x
    value += x
    if (isGrowth) growthUsed += x
  }

  for (let month = 1; month <= i.years * 12; month++) {
    if (month === 1 && i.initialYen > 0) add(i.initialYen, i.account === 'adult')
    add(i.monthlyTsumitateYen, false)
    add(i.monthlyGrowthYen, true)
    value *= 1 + m
    if (capMonth === null && principal >= r.totalCapYen) capMonth = month
    if (month % 12 === 0) {
      const gain = value - principal
      rows.push({
        year: month / 12,
        principalYen: principal,
        valueYen: value,
        gainYen: gain,
        taxableAfterTaxYen: principal + (gain > 0 ? gain * (1 - TAXABLE_RATE) : gain),
      })
    }
  }
  const last = rows[rows.length - 1]
  return {
    rows,
    finalPrincipalYen: last.principalYen,
    finalValueYen: last.valueYen,
    finalGainYen: last.gainYen,
    taxableAfterTaxYen: last.taxableAfterTaxYen,
    taxSavedYen: last.valueYen - last.taxableAfterTaxYen,
    capReachedMonth: capMonth,
    capUsedRatio: last.principalYen / r.totalCapYen,
  }
}
