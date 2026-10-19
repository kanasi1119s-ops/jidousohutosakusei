export type TaxRate = 10 | 8 | 0
export type RoundingMode = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface LineItem {
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface TaxGroup {
  rate: TaxRate
  /** 税抜金額 */
  base: number
  tax: number
  /** 税込金額 */
  gross: number
}

export interface InvoiceTotals {
  lineAmounts: number[]
  groups: TaxGroup[]
  subtotal: number
  taxTotal: number
  total: number
  withholding: number
  /** 請求額（税込合計 - 源泉徴収税額） */
  payable: number
}

/** 1行あたりの金額上限（浮動小数の精度を保つための安全域） */
export const MAX_LINE_AMOUNT = 1e12

export const TAX_RATES: TaxRate[] = [10, 8, 0]

/** 全角数字・記号を半角へ正規化する（例: "１，２００" → "1200"） */
export function toHalfWidth(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
}

/** 数値入力欄の文字列を数値へ。全角・カンマ区切りを許容し、解釈できなければ NaN。 */
export function parseNumber(text: string): number {
  const s = toHalfWidth(text).replace(/[,\s]/g, '')
  if (s === '') return NaN
  return Number(s)
}

/** 整数除算の端数処理（num / den、den > 0、num は非負の整数を想定） */
export function divideWithRounding(num: number, den: number, mode: RoundingMode): number {
  const q = Math.floor(num / den)
  const r = num - q * den
  if (r === 0) return q
  if (mode === 'floor') return q
  if (mode === 'ceil') return q + 1
  return r * 2 >= den ? q + 1 : q
}

/** 明細1行の金額（数量は小数第3位まで扱い、浮動小数誤差を避けるため整数化して計算） */
export function lineAmount(item: LineItem, mode: RoundingMode): number {
  const milli = Math.round(item.quantity * 1000)
  const sign = milli * item.unitPrice < 0 ? -1 : 1
  const abs = Math.abs(milli) * Math.abs(item.unitPrice)
  return sign * divideWithRounding(abs, 1000, mode)
}

/**
 * 源泉徴収税額（報酬・料金等、復興特別所得税込み）。
 * 100万円以下: 10.21%、100万円超の部分: 20.42%。1円未満切り捨て。
 */
export function withholdingTax(taxExclusiveAmount: number): number {
  if (taxExclusiveAmount <= 0) return 0
  const limit = 1_000_000
  if (taxExclusiveAmount <= limit) {
    return Math.floor((taxExclusiveAmount * 1021) / 10000)
  }
  return Math.floor((limit * 1021 + (taxExclusiveAmount - limit) * 2042) / 10000)
}

export function calcTotals(
  items: LineItem[],
  priceMode: PriceMode,
  rounding: RoundingMode,
  applyWithholding: boolean,
): InvoiceTotals {
  const lineAmounts = items.map((it) => lineAmount(it, rounding))
  const sums = new Map<TaxRate, number>()
  items.forEach((it, i) => sums.set(it.taxRate, (sums.get(it.taxRate) ?? 0) + lineAmounts[i]))

  const groups: TaxGroup[] = []
  for (const rate of TAX_RATES) {
    if (!sums.has(rate)) continue
    const sum = sums.get(rate)!
    const neg = sum < 0
    const abs = Math.abs(sum)
    let base: number
    let tax: number
    if (priceMode === 'exclusive') {
      base = abs
      tax = divideWithRounding(abs * rate, 100, rounding)
    } else {
      tax = divideWithRounding(abs * rate, 100 + rate, rounding)
      base = abs - tax
    }
    // 税率ごとに1回だけ端数処理を行う（適格請求書の原則）
    const s = neg ? -1 : 1
    groups.push({ rate, base: s * base, tax: s * tax, gross: s * (base + tax) })
  }

  const subtotal = groups.reduce((a, g) => a + g.base, 0)
  const taxTotal = groups.reduce((a, g) => a + g.tax, 0)
  const total = subtotal + taxTotal
  const withholding = applyWithholding ? withholdingTax(subtotal) : 0
  return { lineAmounts, groups, subtotal, taxTotal, total, withholding, payable: total - withholding }
}

/** 適格請求書発行事業者の登録番号（T + 数字13桁）の形式チェック。空欄は許容（未登録の場合）。 */
export function isValidRegistrationNumber(text: string): boolean {
  const s = toHalfWidth(text).trim().toUpperCase()
  return s === '' || /^T\d{13}$/.test(s)
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}${Math.abs(n).toLocaleString('ja-JP')}円`
}
