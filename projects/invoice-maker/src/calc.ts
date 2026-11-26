export type TaxRate = 10 | 8
export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface InvoiceItem {
  name: string
  quantity: number
  unitPriceYen: number // 税抜単価
  taxRate: TaxRate
}

export interface TaxBreakdown {
  taxRate: TaxRate
  subtotalYen: number // 税抜合計
  taxYen: number // 消費税額（税率ごとに1回端数処理）
  totalYen: number // 税込合計
}

export interface InvoiceTotals {
  breakdowns: TaxBreakdown[]
  subtotalYen: number
  taxYen: number
  totalYen: number
}

/** 全角数字・全角記号を半角にし、カンマ・空白を除いて数値化する。不正なら NaN。 */
export function parseNumberLoose(input: string): number {
  const half = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，\s]/g, '')
  if (half === '' || !/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

export function applyRounding(value: number, mode: RoundingMode): number {
  // 浮動小数点誤差（例: 0.1*3）を避けるため一度丸めてから処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function lineAmountYen(item: InvoiceItem): number {
  // 明細金額は円未満を四捨五入して整数にする
  return Math.round(Math.round(item.quantity * item.unitPriceYen * 1e6) / 1e6)
}

export function calcTotals(items: InvoiceItem[], mode: RoundingMode): InvoiceTotals {
  const rates: TaxRate[] = [10, 8]
  const breakdowns: TaxBreakdown[] = []
  for (const rate of rates) {
    const targets = items.filter((i) => i.taxRate === rate)
    if (targets.length === 0) continue
    const subtotal = targets.reduce((sum, i) => sum + lineAmountYen(i), 0)
    const tax = applyRounding((subtotal * rate) / 100, mode)
    breakdowns.push({ taxRate: rate, subtotalYen: subtotal, taxYen: tax, totalYen: subtotal + tax })
  }
  const subtotalYen = breakdowns.reduce((s, b) => s + b.subtotalYen, 0)
  const taxYen = breakdowns.reduce((s, b) => s + b.taxYen, 0)
  return { breakdowns, subtotalYen, taxYen, totalYen: subtotalYen + taxYen }
}

/** 適格請求書発行事業者の登録番号: 「T」+ 数字13桁（半角）。 */
export function isValidRegistrationNumber(value: string): boolean {
  return /^T\d{13}$/.test(value)
}

export function formatYen(n: number): string {
  return n.toLocaleString('ja-JP') + '円'
}
