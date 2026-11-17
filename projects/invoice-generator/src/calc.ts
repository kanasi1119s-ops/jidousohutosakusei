export type TaxRate = 10 | 8
export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface Item {
  name: string
  qty: number
  unitPrice: number // 税抜単価（円）
  taxRate: TaxRate
}

export interface RateTotal {
  rate: TaxRate
  subtotal: number // 税抜合計
  tax: number // 税率ごとに1回だけ端数処理した消費税額
}

export interface InvoiceTotals {
  lineAmounts: number[]
  byRate: RateTotal[]
  subtotal: number
  tax: number
  withholding: number
  total: number
}

/** 全角数字・全角記号・カンマを半角に正規化して数値化する。数値にできなければ NaN。 */
export function parseNumberInput(raw: string): number {
  const half = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，\s]/g, '')
  if (half === '') return NaN
  if (!/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

export function applyRounding(value: number, mode: RoundingMode): number {
  // 浮動小数点誤差（例: 0.1*3）を避けるため一度丸めてから処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function lineAmount(item: Item): number {
  return Math.round(Math.round(item.qty * item.unitPrice * 1e6) / 1e6)
}

/**
 * 源泉徴収税額（報酬・料金等の所得税及び復興特別所得税）。
 * 支払金額（税抜）が100万円以下: 10.21%、超える部分: 20.42%。1円未満切捨て。
 */
export function withholdingTax(taxExcludedAmount: number): number {
  const a = Math.max(0, taxExcludedAmount)
  const base = Math.min(a, 1_000_000)
  const over = Math.max(0, a - 1_000_000)
  return Math.floor((base * 1021) / 10000 + (over * 2042) / 10000)
}

export function calcInvoice(
  items: Item[],
  rounding: RoundingMode,
  applyWithholding: boolean,
): InvoiceTotals {
  const lineAmounts = items.map(lineAmount)
  const byRate: RateTotal[] = ([10, 8] as TaxRate[])
    .map((rate) => {
      const subtotal = items.reduce((s, it, i) => (it.taxRate === rate ? s + lineAmounts[i] : s), 0)
      const used = items.some((it) => it.taxRate === rate)
      return { rate, subtotal, tax: applyRounding((subtotal * rate) / 100, rounding), used }
    })
    .filter((r) => r.used)
    .map(({ rate, subtotal, tax }) => ({ rate, subtotal, tax }))
  const subtotal = byRate.reduce((s, r) => s + r.subtotal, 0)
  const tax = byRate.reduce((s, r) => s + r.tax, 0)
  const withholding = applyWithholding ? withholdingTax(subtotal) : 0
  return { lineAmounts, byRate, subtotal, tax, withholding, total: subtotal + tax - withholding }
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
