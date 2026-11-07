export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'

export interface LineItem {
  name: string
  quantity: number
  unitPrice: number // 税抜単価(円)
  taxRate: TaxRate
}

export interface RateSummary {
  rate: TaxRate
  subtotal: number // 税抜小計
  tax: number // 税額(税率ごとに1回端数処理)
}

export interface InvoiceTotals {
  byRate: RateSummary[]
  subtotal: number
  tax: number
  total: number
}

export const MAX_INPUT = 1e10

/** 全角数字・全角記号・カンマ・円記号を除去/半角化して数値に変換する。不正なら NaN。 */
export function parseNumberInput(raw: string): number {
  const half = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，、円¥￥\s]/g, '')
  if (half === '' || !/^-?\d*\.?\d+$/.test(half)) return NaN
  const n = Number(half)
  // 安全に扱える整数範囲を超える入力(誤入力)は受け付けない
  return Math.abs(n) > MAX_INPUT ? NaN : n
}

export function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差(例: 0.1+0.2)を避けるため、1e-9 の幅で丸めてから処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function lineAmount(item: LineItem): number {
  if (!Number.isFinite(item.quantity) || !Number.isFinite(item.unitPrice)) return 0
  // 明細の金額は税抜。小数数量に対応するため、円未満は切り捨て。
  return Math.floor(Math.round(item.quantity * item.unitPrice * 1e6) / 1e6)
}

/** 適格請求書の要件に沿い、税率ごとに合計した対価の額に対して税額を1回だけ端数処理する。 */
export function calcTotals(items: LineItem[], rounding: Rounding): InvoiceTotals {
  const byRate: RateSummary[] = ([10, 8] as TaxRate[])
    .map((rate) => {
      const subtotal = items.filter((i) => i.taxRate === rate).reduce((s, i) => s + lineAmount(i), 0)
      const tax = applyRounding((subtotal * rate) / 100, rounding)
      return { rate, subtotal, tax }
    })
    .filter((r) => r.subtotal !== 0)
  const subtotal = byRate.reduce((s, r) => s + r.subtotal, 0)
  const tax = byRate.reduce((s, r) => s + r.tax, 0)
  return { byRate, subtotal, tax, total: subtotal + tax }
}

/** 登録番号: T + 13桁の数字（全角入力は半角化して検証）。 */
export function normalizeRegistrationNumber(raw: string): string {
  return raw
    .replace(/[Ｔ]/g, 'T')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s-]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(raw: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(raw))
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
