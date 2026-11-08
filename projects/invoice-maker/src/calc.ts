import type { LineItem, PriceMode, Rounding, TaxRate } from './model'

export interface RateGroup {
  rate: TaxRate
  /** 税抜対象額 */
  taxableAmount: number
  tax: number
  /** 税込額 */
  grossAmount: number
}

export interface InvoiceTotals {
  groups: RateGroup[]
  subtotal: number
  tax: number
  total: number
}

/** 整数同士の割り算を指定方式で丸める（浮動小数点誤差を避ける）。num >= 0, den > 0。 */
export function divideRounded(num: number, den: number, mode: Rounding): number {
  if (mode === 'floor') return Math.floor(num / den)
  if (mode === 'ceil') return Math.ceil(num / den)
  return Math.floor((2 * num + den) / (2 * den))
}

/** 明細金額（円未満は四捨五入）。数量は小数可。 */
export function lineAmount(item: LineItem): number {
  const cents = Math.round(item.quantity * 1000) // 数量は小数第3位まで
  return divideRounded(cents * Math.round(item.unitPrice), 1000, 'round')
}

/**
 * 国税庁の取扱い: 端数処理は「1枚の請求書につき税率ごとに1回」。
 * 明細ごとに税額を計算して丸めてから合計する方法は用いない。
 */
export function calcInvoice(items: LineItem[], mode: PriceMode, rounding: Rounding): InvoiceTotals {
  const groups: RateGroup[] = []
  for (const rate of [10, 8] as TaxRate[]) {
    const lines = items.filter((it) => it.taxRate === rate)
    if (lines.length === 0) continue
    const sum = lines.reduce((acc, it) => acc + lineAmount(it), 0)
    if (mode === 'exclusive') {
      const tax = divideRounded(sum * rate, 100, rounding)
      groups.push({ rate, taxableAmount: sum, tax, grossAmount: sum + tax })
    } else {
      const tax = divideRounded(sum * rate, 100 + rate, rounding)
      groups.push({ rate, taxableAmount: sum - tax, tax, grossAmount: sum })
    }
  }
  const subtotal = groups.reduce((a, g) => a + g.taxableAmount, 0)
  const tax = groups.reduce((a, g) => a + g.tax, 0)
  return { groups, subtotal, tax, total: subtotal + tax }
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
