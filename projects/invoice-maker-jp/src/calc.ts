export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface LineItem {
  name: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface RateTotal {
  rate: TaxRate
  /** 税抜の対象額 */
  base: number
  tax: number
  /** 税込の合計 */
  total: number
}

export interface Totals {
  lineAmounts: number[]
  byRate: RateTotal[]
  subtotal: number
  tax: number
  total: number
}

export const MAX_ABS_AMOUNT = 1_000_000_000_000
export const MAX_QUANTITY = 100_000
export const MAX_UNIT_PRICE = 100_000_000

/** 全角の数字・記号・空白を半角に揃える（全角数字入力の対策） */
export function toHalfWidth(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/[−ー－―‐]/g, '-')
}

/** 数値入力を解釈する。空欄・不正な形式は null。カンマ区切りは許容する。 */
export function parseNumber(text: string): number | null {
  const t = toHalfWidth(text).replace(/[,\s]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** 分子/分母を符号を考慮して整数化する（負数は絶対値で丸めて符号を戻す） */
export function applyRounding(numerator: number, denominator: number, mode: Rounding): number {
  const sign = numerator < 0 ? -1 : 1
  const abs = Math.abs(numerator)
  const q = Math.floor(abs / denominator)
  const r = abs - q * denominator
  let result = q
  if (mode === 'ceil') result = r > 0 ? q + 1 : q
  else if (mode === 'round') result = r * 2 >= denominator ? q + 1 : q
  return sign * result || 0
}

/** 数量（小数第2位まで）と単価（円）から明細金額を求める。浮動小数点誤差を避け整数で計算する。 */
export function lineAmount(item: LineItem, rounding: Rounding): number {
  const hundredths = Math.round(item.quantity * 100)
  return applyRounding(item.unitPriceYen * hundredths, 100, rounding)
}

/**
 * 適用税率ごとに合計し、税率ごとに1回だけ端数処理して消費税額を求める
 * （適格請求書の記載ルール: 1請求書あたり税率ごとに1回の端数処理）。
 */
export function computeTotals(items: LineItem[], priceMode: PriceMode, rounding: Rounding): Totals {
  const lineAmounts = items.map((item) => lineAmount(item, rounding))
  const sums = new Map<TaxRate, number>()
  items.forEach((item, i) => {
    sums.set(item.taxRate, (sums.get(item.taxRate) ?? 0) + lineAmounts[i])
  })

  const byRate: RateTotal[] = []
  for (const rate of [10, 8] as TaxRate[]) {
    const sum = sums.get(rate)
    if (sum === undefined) continue
    if (priceMode === 'exclusive') {
      const tax = applyRounding(sum * rate, 100, rounding)
      byRate.push({ rate, base: sum, tax, total: sum + tax })
    } else {
      const tax = applyRounding(sum * rate, 100 + rate, rounding)
      byRate.push({ rate, base: sum - tax, tax, total: sum })
    }
  }

  const subtotal = byRate.reduce((a, r) => a + r.base, 0)
  const tax = byRate.reduce((a, r) => a + r.tax, 0)
  return { lineAmounts, byRate, subtotal, tax, total: subtotal + tax }
}

export function formatYen(value: number): string {
  const sign = value < 0 ? '-' : ''
  return sign + '¥' + Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
