import type { Invoice, LineItem, RoundingMode, TaxRate } from './types'

export const TAX_RATES: TaxRate[] = [10, 8, 0]

/** 1円未満の端数処理。符号は保ったまま絶対値に対して処理する（値引き行にも対応）。 */
function divide(num: bigint, den: bigint, mode: RoundingMode): bigint {
  const neg = num < 0n
  const a = neg ? -num : num
  const q = a / den
  const r = a % den
  let m = q
  if (mode === 'ceil' && r > 0n) m = q + 1n
  else if (mode === 'round' && r * 2n >= den) m = q + 1n
  return neg ? -m : m
}

/**
 * 行金額 = 数量 × 単価。浮動小数点誤差（例: 0.29 × 100 = 28.999…）を避けるため、
 * 数量を1/1000単位、単価を1/100円単位の整数に直して BigInt で計算する。
 */
export function lineAmount(item: Pick<LineItem, 'quantity' | 'unitPrice'>, mode: RoundingMode): number {
  // 未入力（NaN）の行は0円として扱い、計算全体が落ちないようにする
  const q = Number.isFinite(item.quantity) ? item.quantity : 0
  const p = Number.isFinite(item.unitPrice) ? item.unitPrice : 0
  const qtyMilli = BigInt(Math.round(q * 1000))
  const priceCents = BigInt(Math.round(p * 100))
  return Number(divide(qtyMilli * priceCents, 100000n, mode))
}

export interface RateSummary {
  rate: TaxRate
  /** 入力ベースの合計（税抜入力なら税抜、税込入力なら税込） */
  subtotal: number
  net: number
  tax: number
  gross: number
}

export interface InvoiceTotals {
  lines: number[]
  byRate: RateSummary[]
  net: number
  tax: number
  gross: number
  withholding: number
  payable: number
}

/** 復興特別所得税を含む源泉徴収税額（報酬・料金等。100万円以下 10.21%、超過分 20.42%、1円未満切捨て）。 */
export function withholdingTax(base: number): number {
  if (!(base > 0)) return 0
  if (base <= 1_000_000) return Math.floor((base * 1021) / 10000)
  return 102_100 + Math.floor(((base - 1_000_000) * 2042) / 10000)
}

export function calcInvoice(inv: Pick<Invoice, 'items' | 'priceMode' | 'rounding' | 'withholdingEnabled'>): InvoiceTotals {
  const lines = inv.items.map((it) => lineAmount(it, inv.rounding))
  const byRate: RateSummary[] = []
  for (const rate of TAX_RATES) {
    const idx = inv.items.map((it, i) => (it.taxRate === rate ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const subtotal = idx.reduce((s, i) => s + lines[i], 0)
    let net: number
    let tax: number
    if (inv.priceMode === 'exclusive') {
      net = subtotal
      // 端数処理は適格請求書1枚につき税率ごとに1回
      tax = Number(divide(BigInt(subtotal) * BigInt(rate), 100n, inv.rounding))
    } else {
      tax = Number(divide(BigInt(subtotal) * BigInt(rate), BigInt(100 + rate), inv.rounding))
      net = subtotal - tax
    }
    byRate.push({ rate, subtotal, net, tax, gross: net + tax })
  }
  const net = byRate.reduce((s, r) => s + r.net, 0)
  const tax = byRate.reduce((s, r) => s + r.tax, 0)
  const gross = net + tax
  const withholding = inv.withholdingEnabled ? withholdingTax(net) : 0
  return { lines, byRate, net, tax, gross, withholding, payable: gross - withholding }
}
