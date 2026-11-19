// 請求書の金額計算。すべて整数（円）で計算し、浮動小数の誤差を避ける。
// 消費税額の端数処理は「1枚の請求書につき、税率ごとに1回」（国税庁 インボイス Q&A 問57）。

export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'
export type TaxRate = 10 | 8 | 0

export interface Item {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  taxRate: TaxRate
}

export interface RateGroup {
  rate: TaxRate
  /** 税抜モード: 税抜合計 / 税込モード: 税込合計 */
  amount: number
  /** 税率ごとに1回だけ端数処理した消費税額（税込モードでは内税額） */
  tax: number
}

export interface InvoiceTotals {
  lineAmounts: number[]
  groups: RateGroup[]
  totalTax: number
  grandTotal: number
}

/** 整数 n を整数 d で割り、指定の方法で整数にする。負数は絶対値で処理して符号を戻す。 */
export function divideRounded(n: number, d: number, mode: Rounding): number {
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const q = Math.floor(abs / d)
  const r = abs - q * d
  let result = q
  if (r > 0) {
    if (mode === 'ceil') result = q + 1
    else if (mode === 'round' && r * 2 >= d) result = q + 1
  }
  return sign * result || 0
}

/** 整数演算の精度（2^53）を超えないための入力上限。 */
export const MAX_QUANTITY = 10000
export const MAX_UNIT_PRICE = 100_000_000

export function isInRange(quantity: number, unitPrice: number): boolean {
  return Math.abs(quantity) <= MAX_QUANTITY && Math.abs(unitPrice) <= MAX_UNIT_PRICE
}

export function lineAmount(item: Item, rounding: Rounding): number {
  const qtyMilli = Math.round(item.quantity * 1000)
  return divideRounded(qtyMilli * item.unitPrice, 1000, rounding)
}

export function calculate(items: Item[], priceMode: PriceMode, rounding: Rounding): InvoiceTotals {
  const lineAmounts = items.map((it) => lineAmount(it, rounding))
  const rates: TaxRate[] = [10, 8, 0]
  const groups: RateGroup[] = []
  for (const rate of rates) {
    const idx = items.map((it, i) => (it.taxRate === rate ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const amount = idx.reduce((s, i) => s + lineAmounts[i], 0)
    let tax = 0
    if (rate !== 0) {
      tax =
        priceMode === 'exclusive'
          ? divideRounded(amount * rate, 100, rounding)
          : divideRounded(amount * rate, 100 + rate, rounding)
    }
    groups.push({ rate, amount, tax })
  }
  const totalTax = groups.reduce((s, g) => s + g.tax, 0)
  const grandTotal = groups.reduce((s, g) => s + (priceMode === 'exclusive' ? g.amount + g.tax : g.amount), 0)
  return { lineAmounts, groups, totalTax, grandTotal }
}

const FULLWIDTH_MAP: Record<string, string> = { '．': '.', '，': ',', '－': '-', 'ー': '-', '−': '-', '　': ' ' }

/** 全角数字・全角記号を半角にする（数値・登録番号の入力用）。 */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．，－ー−　]/g, (c) => FULLWIDTH_MAP[c] ?? c)
}

/** 入力文字列を数値にする。全角・カンマ・空白を許容。解釈できなければ null。 */
export function parseNumber(s: string): number | null {
  const t = toHalfWidth(s).replace(/[,\s]/g, '')
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function normalizeRegistrationNumber(s: string): string {
  return toHalfWidth(s).replace(/[\s-]/g, '').toUpperCase()
}

export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(s))
}

export function formatYen(n: number): string {
  return n.toLocaleString('ja-JP') + '円'
}
