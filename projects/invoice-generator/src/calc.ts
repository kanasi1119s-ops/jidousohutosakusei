export type TaxRate = 10 | 8
export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface LineItem {
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface RateSummary {
  taxRate: TaxRate
  subtotal: number
  tax: number
}

export interface InvoiceTotals {
  lineAmounts: number[]
  byRate: RateSummary[]
  subtotal: number
  tax: number
  total: number
}

/** 全角数字・全角記号・カンマを半角に直して数値化する。解釈できなければ NaN。 */
export function parseNumber(input: string): number {
  const half = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，、\s円¥￥]/g, '')
  if (half === '' || !/^-?\d*\.?\d+$/.test(half)) return NaN
  return Number(half)
}

export function applyRounding(value: number, mode: RoundingMode): number {
  // 浮動小数点誤差（例: 1.1*100=110.00000000000001）を避けるため一度丸める
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

/**
 * 適格請求書は「税率ごとに区分して合計した対価の額」に対し、
 * 税率ごとに1回だけ端数処理をして消費税額を算出する。
 */
export function calcTotals(items: LineItem[], rounding: RoundingMode): InvoiceTotals {
  // 数量・単価が未入力/不正(NaN)の行は0円として扱い、画面に NaN を出さない
  const lineAmounts = items.map((i) => {
    const v = Math.round(i.quantity * i.unitPrice)
    return Number.isFinite(v) ? v : 0
  })
  const byRate: RateSummary[] = []
  for (const rate of [10, 8] as TaxRate[]) {
    let sub = 0
    let used = false
    items.forEach((item, idx) => {
      if (item.taxRate === rate) {
        sub += lineAmounts[idx]
        used = true
      }
    })
    if (used) {
      byRate.push({ taxRate: rate, subtotal: sub, tax: applyRounding((sub * rate) / 100, rounding) })
    }
  }
  const subtotal = byRate.reduce((a, r) => a + r.subtotal, 0)
  const tax = byRate.reduce((a, r) => a + r.tax, 0)
  return { lineAmounts, byRate, subtotal, tax, total: subtotal + tax }
}

export function isValidRegistrationNumber(value: string): boolean {
  return /^T\d{13}$/.test(value)
}

export function formatYen(n: number): string {
  if (!Number.isFinite(n)) return '¥0'
  return '¥' + n.toLocaleString('ja-JP')
}
