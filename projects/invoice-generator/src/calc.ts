// 請求書の金額計算。インボイス制度では「税率ごとに区分した合計額」に対して
// 消費税額の端数処理を請求書1枚につき税率ごとに1回だけ行う。
// 金額はすべて整数の円で扱い、浮動小数点誤差を避けるため整数演算で計算する。

export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface LineInput {
  name: string
  qty: number
  unitPrice: number
  rate: TaxRate
}

export interface RateGroup {
  rate: TaxRate
  /** 税抜の対価の合計 */
  subtotal: number
  /** 消費税額（税率ごとに1回端数処理） */
  tax: number
  /** 税込合計 */
  total: number
}

export interface InvoiceTotals {
  groups: RateGroup[]
  subtotal: number
  tax: number
  total: number
  withholding: number
  payable: number
}

/** 割り算の端数処理を整数のまま行う（num, den は正の整数、num は非負） */
export function divideRounded(num: number, den: number, mode: Rounding): number {
  const q = Math.floor(num / den)
  const r = num - q * den
  if (r === 0) return q
  if (mode === 'floor') return q
  if (mode === 'ceil') return q + 1
  return r * 2 >= den ? q + 1 : q
}

/** 数量×単価の行金額（円）。数量は小数3桁まで扱い、行金額は円未満を指定の方式で処理する */
export function lineAmount(qty: number, unitPrice: number, mode: Rounding): number {
  const qty1000 = Math.round(qty * 1000)
  const price = Math.round(unitPrice)
  if (qty1000 <= 0 || price === 0) return 0
  const sign = price < 0 ? -1 : 1
  const v = divideRounded(qty1000 * Math.abs(price), 1000, mode)
  return sign * v
}

/**
 * 源泉徴収税額（報酬・料金等。復興特別所得税を含む）。
 * 支払金額（消費税を区分して明記した場合は税抜金額）が100万円以下の部分は10.21%、
 * 超える部分は20.42%。1円未満は切り捨て。
 */
export function withholdingTax(base: number): number {
  if (base <= 0) return 0
  const LIMIT = 1_000_000
  if (base <= LIMIT) return Math.floor((base * 1021) / 10000)
  return Math.floor((LIMIT * 1021 + (base - LIMIT) * 2042) / 10000)
}

export function computeInvoice(
  lines: LineInput[],
  mode: PriceMode,
  rounding: Rounding,
  withholding: boolean,
): InvoiceTotals {
  const sums: Record<TaxRate, number> = { 10: 0, 8: 0 }
  for (const l of lines) {
    sums[l.rate] += lineAmount(l.qty, l.unitPrice, rounding)
  }
  const groups: RateGroup[] = []
  for (const rate of [10, 8] as TaxRate[]) {
    const hasLine = lines.some((l) => l.rate === rate)
    if (!hasLine) continue
    const sum = sums[rate]
    const abs = Math.abs(sum)
    const sign = sum < 0 ? -1 : 1
    if (mode === 'exclusive') {
      const tax = sign * divideRounded(abs * rate, 100, rounding)
      groups.push({ rate, subtotal: sum, tax, total: sum + tax })
    } else {
      const tax = sign * divideRounded(abs * rate, 100 + rate, rounding)
      groups.push({ rate, subtotal: sum - tax, tax, total: sum })
    }
  }
  const subtotal = groups.reduce((a, g) => a + g.subtotal, 0)
  const tax = groups.reduce((a, g) => a + g.tax, 0)
  const total = subtotal + tax
  const wh = withholding ? withholdingTax(subtotal) : 0
  return { groups, subtotal, tax, total, withholding: wh, payable: total - wh }
}

/** 適格請求書発行事業者の登録番号の形式（T + 数字13桁）。全角入力は半角に直してから判定する */
export function normalizeRegistrationNumber(input: string): string {
  return input
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-－ー]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(input: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(input))
}

/** 全角数字・カンマ付きの入力を数値に変換する。変換できなければ NaN */
export function parseNumberInput(input: string): number {
  const s = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,\s]/g, '')
    .replace(/[．]/g, '.')
    .replace(/[－−]/g, '-')
  if (s === '') return NaN
  return Number(s)
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '¥' + Math.abs(n).toLocaleString('ja-JP')
}
