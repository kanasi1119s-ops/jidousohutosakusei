export type TaxRate = 10 | 8 | 0
export type Rounding = 'floor' | 'round' | 'ceil'

export interface InvoiceItem {
  description: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface RateSummary {
  taxRate: TaxRate
  subtotalYen: number
  taxYen: number
}

export interface InvoiceTotals {
  byRate: RateSummary[]
  subtotalYen: number
  taxYen: number
  totalYen: number
}

/** 全角数字・全角記号を半角に、カンマ・空白を除去して数値化する。不正なら NaN。 */
export function parseNumberInput(raw: string): number {
  const half = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[，,\s]/g, '')
    .replace(/[－−ー]/g, '-')
  if (half === '' || !/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

export function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差（例: 0.1+0.2）で端数が狂わないよう、小数第6位で丸めてから端数処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function lineAmountYen(item: InvoiceItem): number {
  return Math.round(item.quantity * item.unitPriceYen * 1e6) / 1e6
}

/**
 * 適格請求書の記載事項: 税率ごとに区分した対価の額の合計と、税率ごとの消費税額等。
 * 税額の端数処理は「1請求書につき税率ごとに1回」。
 */
export function calcTotals(items: InvoiceItem[], rounding: Rounding): InvoiceTotals {
  const rates: TaxRate[] = [10, 8, 0]
  const byRate: RateSummary[] = []
  for (const rate of rates) {
    const targets = items.filter((i) => i.taxRate === rate)
    if (targets.length === 0) continue
    const subtotalYen = applyRounding(
      targets.reduce((sum, i) => sum + lineAmountYen(i), 0),
      'round',
    )
    const taxYen = applyRounding((subtotalYen * rate) / 100, rounding)
    byRate.push({ taxRate: rate, subtotalYen, taxYen })
  }
  const subtotalYen = byRate.reduce((s, r) => s + r.subtotalYen, 0)
  const taxYen = byRate.reduce((s, r) => s + r.taxYen, 0)
  return { byRate, subtotalYen, taxYen, totalYen: subtotalYen + taxYen }
}

/** 登録番号の形式チェック（T + 数字13桁）。全角は半角に正規化して判定する。 */
export function normalizeRegistrationNumber(raw: string): string {
  return raw
    .replace(/[Ｔ]/g, 'T')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s-－−ー]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(raw: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(raw))
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
