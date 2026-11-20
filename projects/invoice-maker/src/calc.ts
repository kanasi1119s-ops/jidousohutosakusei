export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'

export interface Item {
  description: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface RateSummary {
  rate: TaxRate
  subtotalYen: number
  taxYen: number
}

export interface InvoiceTotals {
  lineAmounts: number[]
  byRate: RateSummary[]
  totalExclYen: number
  totalTaxYen: number
  totalYen: number
}

export const MAX_ABS = 1_000_000_000_000

/** 全角数字・全角記号・カンマ・円記号を正規化して数値化する。解釈できなければ NaN。 */
export function parseNumber(input: string): number {
  const s = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，、￥¥円\s]/g, '')
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return NaN
  const n = Number(s)
  // 桁あふれ（浮動小数点で整数円を保てない巨大値）を拒否する
  return Math.abs(n) > MAX_ABS ? NaN : n
}

/** 浮動小数点誤差（1.1*100=110.00000000000001 等）を除いてから端数処理する。 */
export function applyRounding(value: number, mode: Rounding): number {
  const v = Number(value.toFixed(6))
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

/**
 * 適格請求書の端数処理ルール: 消費税額は「1請求書につき税率ごとに1回」だけ端数処理する。
 * 明細ごとに税額を丸めて合計してはならない。
 */
export function computeTotals(items: Item[], rounding: Rounding): InvoiceTotals {
  const lineAmounts = items.map((it) => applyRounding(it.quantity * it.unitPriceYen, rounding))
  const byRate: RateSummary[] = []
  for (const rate of [10, 8] as TaxRate[]) {
    let subtotal = 0
    items.forEach((it, i) => {
      if (it.taxRate === rate) subtotal += lineAmounts[i]
    })
    const has = items.some((it) => it.taxRate === rate)
    if (has) {
      byRate.push({ rate, subtotalYen: subtotal, taxYen: applyRounding((subtotal * rate) / 100, rounding) })
    }
  }
  const totalExclYen = byRate.reduce((a, r) => a + r.subtotalYen, 0)
  const totalTaxYen = byRate.reduce((a, r) => a + r.taxYen, 0)
  return { lineAmounts, byRate, totalExclYen, totalTaxYen, totalYen: totalExclYen + totalTaxYen }
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}

/** 登録番号は「T」+数字13桁。全角入力も受け付けて正規化する。形式のみ検証（実在確認は国税庁サイトで）。 */
export function normalizeRegNo(input: string): string {
  return input
    .replace(/[０-９Ｔ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-－]/g, '')
    .toUpperCase()
}

export function isValidRegNoFormat(input: string): boolean {
  return /^T\d{13}$/.test(normalizeRegNo(input))
}
