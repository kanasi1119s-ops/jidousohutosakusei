import {
  TSUMITATE_ANNUAL_LIMIT_YEN,
  GROWTH_ANNUAL_LIMIT_YEN,
  LIFETIME_LIMIT_YEN,
  GROWTH_LIFETIME_LIMIT_YEN,
  TAXABLE_ACCOUNT_TAX_RATE,
} from './limits'

export interface SimulatorInput {
  initialYen: number // 初期投資額（成長投資枠に初年度一括）
  tsumitateMonthlyYen: number // つみたて投資枠 毎月
  growthMonthlyYen: number // 成長投資枠 毎月
  annualReturnPercent: number // 想定年利（%）
  years: number // 運用年数
}

export interface YearRow {
  year: number
  principalYen: number // 累計投資元本（NISA枠内）
  valueYen: number // 評価額
  gainYen: number // 運用益
}

export interface SimulationResult {
  rows: YearRow[]
  principalYen: number
  valueYen: number
  gainYen: number
  taxableAccountTaxYen: number // 同条件を課税口座で運用した場合の税額
  nisaSavingYen: number
  capped: boolean // 生涯枠により積立が打ち切られたか
}

export function validateInput(i: SimulatorInput): string[] {
  const errs: string[] = []
  const nums: [keyof SimulatorInput, string][] = [
    ['initialYen', '初期投資額'],
    ['tsumitateMonthlyYen', 'つみたて投資枠の毎月積立額'],
    ['growthMonthlyYen', '成長投資枠の毎月積立額'],
    ['annualReturnPercent', '想定年利'],
    ['years', '運用年数'],
  ]
  for (const [k, label] of nums) {
    if (typeof i[k] !== 'number' || !Number.isFinite(i[k])) errs.push(`${label}は数値で入力してください。`)
  }
  if (errs.length) return errs
  if (i.initialYen < 0) errs.push('初期投資額は0以上で入力してください。')
  if (i.tsumitateMonthlyYen < 0) errs.push('つみたて投資枠の毎月積立額は0以上で入力してください。')
  if (i.growthMonthlyYen < 0) errs.push('成長投資枠の毎月積立額は0以上で入力してください。')
  if (i.annualReturnPercent < -50 || i.annualReturnPercent > 50)
    errs.push('想定年利は-50〜50%の範囲で入力してください。')
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 60)
    errs.push('運用年数は1〜60の整数で入力してください。')
  if (errs.length) return errs
  if (i.tsumitateMonthlyYen * 12 > TSUMITATE_ANNUAL_LIMIT_YEN)
    errs.push('つみたて投資枠は年間120万円（月10万円）までです。')
  if (i.initialYen + i.growthMonthlyYen * 12 > GROWTH_ANNUAL_LIMIT_YEN)
    errs.push('成長投資枠は年間240万円までです（初期投資額＋毎月積立額×12が対象）。')
  return errs
}

export function simulate(input: SimulatorInput): SimulationResult {
  const errs = validateInput(input)
  if (errs.length) throw new Error(errs.join('\n'))
  const monthlyRate = Math.pow(1 + input.annualReturnPercent / 100, 1 / 12) - 1
  let value = 0
  let principal = 0
  let growthPrincipal = 0
  let capped = false
  const rows: YearRow[] = []

  const invest = (amountYen: number, growth: boolean): void => {
    let a = Math.min(amountYen, LIFETIME_LIMIT_YEN - principal)
    if (growth) a = Math.min(a, GROWTH_LIFETIME_LIMIT_YEN - growthPrincipal)
    if (a < amountYen) capped = true
    if (a <= 0) return
    value += a
    principal += a
    if (growth) growthPrincipal += a
  }

  invest(input.initialYen, true)
  for (let y = 1; y <= input.years; y++) {
    for (let m = 0; m < 12; m++) {
      invest(input.tsumitateMonthlyYen, false)
      invest(input.growthMonthlyYen, true)
      value *= 1 + monthlyRate // 月初に投資し、月末に運用成果が反映される
    }
    rows.push({ year: y, principalYen: principal, valueYen: Math.round(value), gainYen: Math.round(value - principal) })
  }
  const gain = Math.round(value - principal)
  const tax = Math.max(0, Math.floor(gain * TAXABLE_ACCOUNT_TAX_RATE))
  return {
    rows,
    principalYen: principal,
    valueYen: Math.round(value),
    gainYen: gain,
    taxableAccountTaxYen: tax,
    nisaSavingYen: tax,
    capped,
  }
}

// 全角数字・カンマを半角に正規化して数値化（空文字・不正は NaN）
export function parseNumberLoose(text: string): number {
  const half = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .replace(/[－−]/g, '-')
    .replace(/[,，\s]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(half)) return NaN // 16進数・指数表記・空文字は不正として扱う
  return Number(half)
}
