export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'
export type TaxMode = 'exclusive' | 'inclusive'

export interface Item {
  name: string
  qty: number
  unitPrice: number
  rate: TaxRate
}

export interface Invoice {
  id: string
  number: string
  customer: string
  issueDate: string
  dueDate: string
  taxMode: TaxMode
  rounding: Rounding
  items: Item[]
  note: string
}

export interface RateGroup {
  rate: TaxRate
  /** 税抜対価の合計 */
  subtotalExcl: number
  tax: number
  /** 税込対価の合計 */
  totalIncl: number
}

export interface InvoiceTotals {
  groups: RateGroup[]
  totalExcl: number
  totalTax: number
  grandTotal: number
}

/** 浮動小数点誤差(1.1*100=110.00000000000001 等)を除いてから端数処理する。符号は対称に扱う。 */
export function applyRounding(value: number, mode: Rounding): number {
  const sign = value < 0 ? -1 : 1
  const abs = Number(Math.abs(value).toFixed(6))
  const f = mode === 'floor' ? Math.floor : mode === 'ceil' ? Math.ceil : Math.round
  const r = f(abs)
  return r === 0 ? 0 : sign * r
}

export function lineAmount(item: Item, rounding: Rounding): number {
  return applyRounding(item.qty * item.unitPrice, rounding)
}

export function calcInvoice(inv: Pick<Invoice, 'items' | 'taxMode' | 'rounding'>): InvoiceTotals {
  const groups: RateGroup[] = []
  for (const rate of [10, 8] as const) {
    const lines = inv.items.filter((i) => i.rate === rate)
    if (lines.length === 0) continue
    const sum = lines.reduce((acc, i) => acc + lineAmount(i, inv.rounding), 0)
    if (inv.taxMode === 'exclusive') {
      const tax = applyRounding((sum * rate) / 100, inv.rounding)
      groups.push({ rate, subtotalExcl: sum, tax, totalIncl: sum + tax })
    } else {
      const tax = applyRounding((sum * rate) / (100 + rate), inv.rounding)
      groups.push({ rate, subtotalExcl: sum - tax, tax, totalIncl: sum })
    }
  }
  const totalExcl = groups.reduce((a, g) => a + g.subtotalExcl, 0)
  const totalTax = groups.reduce((a, g) => a + g.tax, 0)
  return { groups, totalExcl, totalTax, grandTotal: totalExcl + totalTax }
}

export function isValidRegistrationNumber(v: string): boolean {
  return /^T\d{13}$/.test(v)
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
