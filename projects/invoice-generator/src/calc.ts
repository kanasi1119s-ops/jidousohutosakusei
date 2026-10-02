export type TaxRate = 10 | 8
export type PriceMode = 'exclusive' | 'inclusive'
export type Rounding = 'floor' | 'round' | 'ceil'

export interface LineItem {
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface InvoiceInput {
  items: LineItem[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
}

export interface RateSummary {
  rate: TaxRate
  /** 税率ごとの対価の額（税抜） */
  taxableYen: number
  /** 税率ごとの消費税額（1請求書・税率ごとに1回端数処理） */
  taxYen: number
  /** 税込合計 */
  totalYen: number
}

export interface InvoiceTotals {
  lineAmounts: number[]
  rates: RateSummary[]
  subtotalYen: number
  taxYen: number
  totalYen: number
  /** 源泉徴収税額（withholding=true のとき。報酬の税抜額が基準） */
  withholdingYen: number
  /** 請求額（税込合計 − 源泉徴収税額） */
  payableYen: number
}

function applyRounding(v: number, mode: Rounding): number {
  // 浮動小数点の誤差を避けるため一度丸める
  const x = Math.round(v * 1e6) / 1e6
  return mode === 'floor' ? Math.floor(x) : mode === 'ceil' ? Math.ceil(x) : Math.round(x)
}

export const MAX_LINE_YEN = 10_000_000_000

export function lineAmount(item: LineItem): number {
  // 明細金額は円未満を切り捨て（税の端数処理は税率ごと合計後に1回のみ）
  const v = Math.floor(Math.round(item.quantity * item.unitPrice * 1e6) / 1e6)
  // 200明細の合計でも安全整数(2^53)を超えないよう、1明細は100億円で頭打ちにする
  return Math.min(v, MAX_LINE_YEN)
}

/** 源泉徴収税額: 100万円以下 10.21%、超過分 20.42%（復興特別所得税込み、円未満切り捨て） */
export function withholdingTax(baseYen: number): number {
  if (baseYen <= 0) return 0
  if (baseYen <= 1_000_000) return Math.floor((baseYen * 1021) / 10000)
  return Math.floor((1_000_000 * 1021) / 10000 + ((baseYen - 1_000_000) * 2042) / 10000)
}

export function calcInvoice(input: InvoiceInput): InvoiceTotals {
  const lineAmounts = input.items.map(lineAmount)
  const rates: RateSummary[] = []
  for (const rate of [10, 8] as const) {
    const sum = input.items.reduce((acc, it, i) => (it.taxRate === rate ? acc + lineAmounts[i] : acc), 0)
    const has = input.items.some((it) => it.taxRate === rate)
    if (!has) continue
    if (input.priceMode === 'exclusive') {
      const tax = applyRounding((sum * rate) / 100, input.rounding)
      rates.push({ rate, taxableYen: sum, taxYen: tax, totalYen: sum + tax })
    } else {
      const tax = applyRounding((sum * rate) / (100 + rate), input.rounding)
      rates.push({ rate, taxableYen: sum - tax, taxYen: tax, totalYen: sum })
    }
  }
  const subtotalYen = rates.reduce((a, r) => a + r.taxableYen, 0)
  const taxYen = rates.reduce((a, r) => a + r.taxYen, 0)
  const totalYen = subtotalYen + taxYen
  const withholdingYen = input.withholding ? withholdingTax(subtotalYen) : 0
  return { lineAmounts, rates, subtotalYen, taxYen, totalYen, withholdingYen, payableYen: totalYen - withholdingYen }
}
