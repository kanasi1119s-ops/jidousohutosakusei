// 新NISA（2024年開始）の制度上限。出典: 金融庁 NISA特設ウェブサイト（基準日は thresholds の AS_OF 参照）
export const LIMITS = {
  tsumitateAnnualYen: 1_200_000,
  growthAnnualYen: 2_400_000,
  lifetimeYen: 18_000_000,
  lifetimeGrowthYen: 12_000_000,
} as const

// 譲渡益・配当等にかかる通常の税率（所得税15% + 復興特別所得税0.315% + 住民税5%）
export const TAX_RATE = 0.20315

export interface NisaInput {
  initialPrincipalYen: number // 既にNISA口座で保有している元本（評価額=元本として扱う）
  monthlyTsumitateYen: number // つみたて投資枠 毎月
  annualGrowthYen: number // 成長投資枠 毎年（各年の初月に一括）
  annualReturnPct: number // 想定年利回り（%）
  feePct: number // 年間コスト（信託報酬等・%）
  years: number // 運用年数
}

export interface YearRow {
  year: number
  principalYen: number
  valueYen: number
  gainYen: number
  taxSavedYen: number
  limitReached: boolean
}

export interface NisaResult {
  rows: YearRow[]
  final: YearRow
  taxableValueYen: number // 同条件で課税口座だった場合の税引後評価額（目安）
}

export function validateInput(i: NisaInput): string[] {
  const errors: string[] = []
  const nums: [number, string][] = [
    [i.initialPrincipalYen, '既存の元本'],
    [i.monthlyTsumitateYen, '毎月のつみたて額'],
    [i.annualGrowthYen, '成長投資枠の年間額'],
    [i.annualReturnPct, '想定年利回り'],
    [i.feePct, '年間コスト'],
    [i.years, '運用年数'],
  ]
  for (const [v, name] of nums) {
    if (!Number.isFinite(v)) errors.push(`${name}は数値で入力してください。`)
  }
  if (errors.length) return errors
  if (i.initialPrincipalYen < 0) errors.push('既存の元本は0以上で入力してください。')
  if (i.initialPrincipalYen > LIMITS.lifetimeYen) errors.push('既存の元本は生涯投資枠1,800万円以下で入力してください。')
  if (i.monthlyTsumitateYen < 0) errors.push('毎月のつみたて額は0以上で入力してください。')
  if (i.monthlyTsumitateYen * 12 > LIMITS.tsumitateAnnualYen)
    errors.push('つみたて投資枠は年120万円（月10万円）までです。')
  if (i.annualGrowthYen < 0) errors.push('成長投資枠の年間額は0以上で入力してください。')
  if (i.annualGrowthYen > LIMITS.growthAnnualYen) errors.push('成長投資枠は年240万円までです。')
  if (i.annualReturnPct < -50 || i.annualReturnPct > 50) errors.push('想定年利回りは-50〜50%の範囲で入力してください。')
  if (i.feePct < 0 || i.feePct > 10) errors.push('年間コストは0〜10%の範囲で入力してください。')
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 60) errors.push('運用年数は1〜60の整数で入力してください。')
  return errors
}

export function simulate(i: NisaInput): NisaResult {
  const net = (1 + (i.annualReturnPct - i.feePct) / 100)
  const monthlyRate = Math.pow(Math.max(net, 0), 1 / 12) - 1
  let principal = i.initialPrincipalYen
  let growthPrincipal = 0
  let value = i.initialPrincipalYen
  const rows: YearRow[] = []

  for (let y = 1; y <= i.years; y++) {
    for (let m = 0; m < 12; m++) {
      let add = 0
      if (m === 0 && i.annualGrowthYen > 0) {
        const g = Math.min(i.annualGrowthYen, LIMITS.lifetimeGrowthYen - growthPrincipal, LIMITS.lifetimeYen - principal)
        if (g > 0) {
          growthPrincipal += g
          principal += g
          add += g
        }
      }
      const t = Math.min(i.monthlyTsumitateYen, LIMITS.lifetimeYen - principal)
      if (t > 0) {
        principal += t
        add += t
      }
      value = (value + add) * (1 + monthlyRate)
    }
    const gain = value - principal
    rows.push({
      year: y,
      principalYen: Math.round(principal),
      valueYen: Math.round(value),
      gainYen: Math.round(gain),
      taxSavedYen: Math.round(Math.max(gain, 0) * TAX_RATE),
      limitReached: principal >= LIMITS.lifetimeYen,
    })
  }
  const final = rows[rows.length - 1]
  const taxable = final.valueYen - Math.max(final.gainYen, 0) * TAX_RATE
  return { rows, final, taxableValueYen: Math.round(taxable) }
}

// 全角数字・カンマを半角に正規化して数値化（空文字はNaN）
export function parseNumber(s: string): number {
  const h = s.replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,\s，]/g, '')
  return h === '' ? NaN : Number(h)
}
