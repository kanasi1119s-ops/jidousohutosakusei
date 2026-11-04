export type TaxRate = 10 | 8 | 0
export type Rounding = 'floor' | 'round' | 'ceil'

export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface RateTotal {
  rate: TaxRate
  subtotalYen: number
  taxYen: number
}

export interface Totals {
  lineAmountsYen: number[]
  byRate: RateTotal[]
  subtotalYen: number
  taxYen: number
  totalYen: number
  withholdingYen: number
  payableYen: number
}

const MAX_ABS = 1e12

/** 全角数字・全角カンマ等を半角に正規化して数値化する。解釈できない場合は NaN。 */
export function parseNumber(input: string): number {
  const normalized = input.normalize('NFKC').replace(/[,\s円¥￥]/g, '').replace(/[−ー―‐]/g, '-')
  if (normalized === '' || normalized === '-') return NaN
  if (!/^-?\d*\.?\d+$/.test(normalized)) return NaN
  const n = Number(normalized)
  if (!Number.isFinite(n) || Math.abs(n) > MAX_ABS) return NaN
  return n
}

export function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差(例: 0.1*3)で境界がずれないよう、微小値を丸めてから処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return v < 0 ? -Math.round(-v) : Math.round(v)
}

/** 源泉徴収税額（報酬・料金。復興特別所得税込み）。1円未満切り捨て。 */
export function calcWithholding(baseYen: number): number {
  if (baseYen <= 0) return 0
  if (baseYen <= 1_000_000) return Math.floor((baseYen * 10.21) / 100)
  return Math.floor(((baseYen - 1_000_000) * 20.42) / 100) + 102_100
}

/**
 * 明細は税抜単価で入力する前提。
 * 適格請求書の要件に合わせ、消費税額は「税率ごとに合計した対価の額」に対して1請求書につき1回だけ端数処理する。
 */
export function calcTotals(items: LineItem[], rounding: Rounding, withholding: boolean): Totals {
  const lineAmountsYen = items.map((it) => applyRounding(safe(it.quantity) * safe(it.unitPriceYen), rounding))
  const rates: TaxRate[] = [10, 8, 0]
  const byRate: RateTotal[] = rates
    .map((rate) => {
      const subtotalYen = items.reduce((sum, it, i) => (it.taxRate === rate ? sum + lineAmountsYen[i] : sum), 0)
      const taxYen = rate === 0 ? 0 : applyRounding((subtotalYen * rate) / 100, rounding)
      return { rate, subtotalYen, taxYen }
    })
    .filter((r) => items.some((it) => it.taxRate === r.rate))
  const subtotalYen = byRate.reduce((s, r) => s + r.subtotalYen, 0)
  const taxYen = byRate.reduce((s, r) => s + r.taxYen, 0)
  const totalYen = subtotalYen + taxYen
  const withholdingYen = withholding ? calcWithholding(subtotalYen) : 0
  return { lineAmountsYen, byRate, subtotalYen, taxYen, totalYen, withholdingYen, payableYen: totalYen - withholdingYen }
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0
}

/** 適格請求書発行事業者の登録番号（T + 13桁の数字）の形式チェック。実在確認は国税庁サイトで行う。 */
export function isValidRegistrationNumber(value: string): boolean {
  return /^T\d{13}$/.test(value.normalize('NFKC').trim())
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}¥${Math.abs(n).toLocaleString('en-US')}`
}
