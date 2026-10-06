export type TaxRate = 10 | 8 | 0
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
  taxRate: TaxRate
  /** 税抜の対価合計 */
  netTotal: number
  /** 消費税額 */
  tax: number
  /** 税込合計 */
  grossTotal: number
}

export interface InvoiceResult {
  lineAmounts: number[]
  summaries: RateSummary[]
  netTotal: number
  taxTotal: number
  grossTotal: number
  withholdingTax: number
  /** 請求額（税込合計 − 源泉徴収税額） */
  payable: number
}

export function roundYen(value: number, mode: Rounding): number {
  // 浮動小数点誤差（例: 1.1*3=3.3000000000000003）で切り上げ・切り捨てがずれないよう丸める
  const v = Number(value.toFixed(6))
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

/** 源泉徴収税額（報酬・料金等: 100万円以下 10.21%、超過分 20.42%。1円未満切り捨て）。base は税抜金額 */
export function withholdingTaxOf(base: number): number {
  if (base <= 0) return 0
  if (base <= 1_000_000) return Math.floor((base * 1021) / 10000)
  return 102_100 + Math.floor(((base - 1_000_000) * 2042) / 10000)
}

export function calculateInvoice(input: InvoiceInput): InvoiceResult {
  const lineAmounts = input.items.map((it) => roundYen(it.quantity * it.unitPrice, input.rounding))

  // 適格請求書では、税率ごとに区分した合計額に対して消費税額の端数処理を「1請求書につき税率ごとに1回」行う
  const rates: TaxRate[] = [10, 8, 0]
  const summaries: RateSummary[] = []
  for (const rate of rates) {
    let sum = 0
    let count = 0
    input.items.forEach((it, i) => {
      if (it.taxRate === rate) {
        sum += lineAmounts[i]
        count++
      }
    })
    if (count === 0) continue
    if (rate === 0) {
      summaries.push({ taxRate: rate, netTotal: sum, tax: 0, grossTotal: sum })
    } else if (input.priceMode === 'exclusive') {
      const tax = roundYen((sum * rate) / 100, input.rounding)
      summaries.push({ taxRate: rate, netTotal: sum, tax, grossTotal: sum + tax })
    } else {
      const tax = roundYen((sum * rate) / (100 + rate), input.rounding)
      summaries.push({ taxRate: rate, netTotal: sum - tax, tax, grossTotal: sum })
    }
  }

  const netTotal = summaries.reduce((a, s) => a + s.netTotal, 0)
  const taxTotal = summaries.reduce((a, s) => a + s.tax, 0)
  const grossTotal = summaries.reduce((a, s) => a + s.grossTotal, 0)
  const withholdingTax = input.withholding ? withholdingTaxOf(netTotal) : 0
  return {
    lineAmounts,
    summaries,
    netTotal,
    taxTotal,
    grossTotal,
    withholdingTax,
    payable: grossTotal - withholdingTax,
  }
}

const FULLWIDTH_OFFSET = 0xfee0

/** 全角数字・全角記号・カンマ・円記号を除去して半角に正規化する */
export function normalizeNumberText(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/[,\s¥￥円]/g, '')
    .replace(/[−ー‐]/g, '-')
}

/** 数値に解釈できない場合は 0。負数・巨大値は許容範囲に丸める */
export function parseNumberInput(text: string, opts: { max?: number; allowNegative?: boolean } = {}): number {
  const n = Number(normalizeNumberText(text))
  if (!Number.isFinite(n)) return 0
  const max = opts.max ?? 999_999_999
  const clamped = Math.min(Math.max(n, opts.allowNegative ? -max : 0), max)
  return clamped
}

/** 適格請求書発行事業者の登録番号（T + 数字13桁）。全角入力・小文字tも受け付けて正規化する */
export function normalizeRegistrationNumber(text: string): string {
  return normalizeNumberText(text).toUpperCase()
}

export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}
