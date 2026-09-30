import {
  GROWTH_ANNUAL_YEN,
  LIFETIME_GROWTH_YEN,
  LIFETIME_TOTAL_YEN,
  TAX_RATE,
  TSUMITATE_ANNUAL_YEN,
} from './limits'

export interface SimulatorInput {
  initialYen: number
  monthlyTsumitateYen: number
  monthlyGrowthYen: number
  annualReturnPct: number
  years: number
}

export interface YearRow {
  year: number
  principalYen: number
  balanceYen: number
  gainYen: number
}

export interface SimulationResult {
  rows: YearRow[]
  principalYen: number
  nisaFinalYen: number
  gainYen: number
  taxableFinalYen: number
  taxSavedYen: number
  warnings: string[]
}

export function validateInput(input: SimulatorInput): string[] {
  const errors: string[] = []
  const nums = Object.values(input)
  if (nums.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    return ['すべての項目に数値を入力してください。']
  }
  if (input.initialYen < 0 || input.monthlyTsumitateYen < 0 || input.monthlyGrowthYen < 0) {
    errors.push('金額は0以上で入力してください。')
  }
  if (input.annualReturnPct < -50 || input.annualReturnPct > 50) {
    errors.push('想定利回りは-50〜50%の範囲で入力してください。')
  }
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > 60) {
    errors.push('積立期間は1〜60年の整数で入力してください。')
  }
  return errors
}

// 全角数字・カンマを半角に直して数値化する（貼り付け入力対策）
export function parseNumberLoose(text: string): number {
  const half = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,\s]/g, '')
    .replace(/．/g, '.')
    .replace(/[−ー]/g, '-')
  if (half === '') return NaN
  return Number(half)
}

/**
 * 月初に拠出し月末に運用益が付く単純モデル。
 * 投資枠は「年間（1〜12月の拠出合計）」と「生涯（簿価残高）」で頭打ちにする。
 * 売却・枠の復活・年途中開始は考慮しない（開始は1月を想定）。
 * 課税口座との比較は、NISAで実際に拠出できた額と同じ額を課税口座に入れ、最終年に全額売却した場合。
 */
export function simulate(input: SimulatorInput): SimulationResult {
  const monthlyRate = Math.pow(1 + input.annualReturnPct / 100, 1 / 12) - 1
  let usedTotal = 0
  let usedGrowth = 0
  let balance = 0
  let principal = 0
  let annualCapHit = false
  let lifetimeCapHit = false
  let pendingInitial = input.initialYen // 初期投資は1年目1月に成長投資枠へ
  const rows: YearRow[] = []

  for (let y = 1; y <= input.years; y++) {
    let tLeft = TSUMITATE_ANNUAL_YEN
    let gLeft = GROWTH_ANNUAL_YEN
    for (let m = 1; m <= 12; m++) {
      const wantT = input.monthlyTsumitateYen
      const wantG = input.monthlyGrowthYen + pendingInitial
      pendingInitial = 0
      const lifeLeft = LIFETIME_TOTAL_YEN - usedTotal
      const lifeGrowthLeft = LIFETIME_GROWTH_YEN - usedGrowth
      const t = Math.min(wantT, tLeft, lifeLeft)
      const g = Math.min(wantG, gLeft, lifeGrowthLeft, lifeLeft - t)
      if (t < wantT || g < wantG) {
        if (lifeLeft - t - g <= 0 || lifeGrowthLeft - g <= 0) lifetimeCapHit = true
        else annualCapHit = true
      }
      tLeft -= t
      gLeft -= g
      usedTotal += t + g
      usedGrowth += g
      principal += t + g
      balance = (balance + t + g) * (1 + monthlyRate)
    }
    rows.push({ year: y, principalYen: principal, balanceYen: balance, gainYen: balance - principal })
  }

  const warnings: string[] = []
  if (annualCapHit) warnings.push('年間投資枠（つみたて120万円／成長240万円）を超える分は投資しない前提で試算しています。')
  if (lifetimeCapHit) warnings.push('生涯投資枠（1,800万円／うち成長1,200万円）に達したため、それ以降の拠出は行わない前提で試算しています。')

  // 課税口座: 同じ拠出・同じ利回りなら評価額は同じ。最終年に売却して利益に課税される
  const gain = balance - principal
  const taxableFinal = gain > 0 ? balance - gain * TAX_RATE : balance

  return {
    rows,
    principalYen: principal,
    nisaFinalYen: balance,
    gainYen: gain,
    taxableFinalYen: taxableFinal,
    taxSavedYen: gain > 0 ? gain * TAX_RATE : 0,
    warnings,
  }
}
