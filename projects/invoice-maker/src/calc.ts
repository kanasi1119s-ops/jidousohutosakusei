import type { Invoice, Line, Rounding, TaxRate } from './model'

/** 非負整数 n を d で割り、指定方式で整数化する（符号付きは絶対値で処理し、四捨五入は絶対値の半分以上で切り上げ）。 */
export function divideRound(n: number, d: number, mode: Rounding): number {
  const sign = n < 0 ? -1 : 1
  const a = Math.abs(n)
  const q = Math.floor(a / d)
  const r = a - q * d
  let res = q
  if (mode === 'ceil') {
    if (r > 0) res = q + 1
  } else if (mode === 'round') {
    if (r * 2 >= d) res = q + 1
  }
  // floor は絶対値の切り捨て（0方向）。マイナス明細（値引き）でも税額の絶対値を過大にしない。
  return sign * res
}

export function roundValue(x: number, mode: Rounding): number {
  // 浮動小数点ノイズ（0.1*3 など）を除去してから整数化する。
  const v = Math.round(x * 1e6) / 1e6
  const sign = v < 0 ? -1 : 1
  const a = Math.abs(v)
  const f = Math.floor(a)
  let res = f
  if (mode === 'ceil') res = a > f ? f + 1 : f
  else if (mode === 'round') res = a - f >= 0.5 ? f + 1 : f
  return sign * res
}

export function lineAmount(line: Line, mode: Rounding): number {
  return roundValue(line.quantity * line.unitPrice, mode)
}

export interface RateGroup {
  rate: TaxRate
  /** 税抜の対価の額 */
  subtotal: number
  /** 税率ごとに1回だけ端数処理した消費税額 */
  tax: number
  /** 税込の対価の額 */
  total: number
}

export interface InvoiceTotals {
  groups: RateGroup[]
  subtotal: number
  tax: number
  total: number
  withholding: number
  /** 請求額（税込合計 − 源泉徴収税額） */
  payable: number
}

const RATES: TaxRate[] = [10, 8, 0]

/**
 * 源泉徴収税額（復興特別所得税込み）。
 * 100万円以下: 10.21% / 100万円超の部分: 20.42%。1円未満切り捨て。
 */
export function withholdingTax(base: number): number {
  if (base <= 0) return 0
  const LIMIT = 1_000_000
  if (base <= LIMIT) return Math.floor((base * 1021) / 10000)
  return Math.floor((LIMIT * 1021) / 10000 + ((base - LIMIT) * 2042) / 10000)
}

export function calcInvoice(inv: Pick<Invoice, 'lines' | 'priceMode' | 'rounding' | 'withholding'>): InvoiceTotals {
  const groups: RateGroup[] = []
  for (const rate of RATES) {
    const lines = inv.lines.filter((l) => l.taxRate === rate)
    if (lines.length === 0) continue
    const sum = lines.reduce((acc, l) => acc + lineAmount(l, inv.rounding), 0)
    let subtotal: number
    let tax: number
    if (inv.priceMode === 'exclusive') {
      subtotal = sum
      tax = divideRound(sum * rate, 100, inv.rounding)
    } else {
      tax = divideRound(sum * rate, 100 + rate, inv.rounding)
      subtotal = sum - tax
    }
    groups.push({ rate, subtotal, tax, total: subtotal + tax })
  }
  const subtotal = groups.reduce((a, g) => a + g.subtotal, 0)
  const tax = groups.reduce((a, g) => a + g.tax, 0)
  const total = subtotal + tax
  const withholding = inv.withholding ? withholdingTax(subtotal) : 0
  return { groups, subtotal, tax, total, withholding, payable: total - withholding }
}

export function validateInvoice(inv: Invoice, issuerRegistration: string): string[] {
  const errors: string[] = []
  if (inv.number.trim() === '') errors.push('請求書番号を入力してください。')
  if (inv.clientName.trim() === '') errors.push('請求先名を入力してください。')
  if (inv.lines.length === 0) errors.push('明細を1行以上入力してください。')
  inv.lines.forEach((l, i) => {
    if (!Number.isFinite(l.quantity) || !Number.isFinite(l.unitPrice)) {
      errors.push(`明細${i + 1}: 数量・単価は数値で入力してください。`)
    } else if (l.quantity < 0) {
      errors.push(`明細${i + 1}: 数量は0以上で入力してください（値引きは単価をマイナスにします）。`)
    }
    if (l.description.trim() === '' && l.unitPrice !== 0) {
      errors.push(`明細${i + 1}: 品名を入力してください。`)
    }
  })
  const t = calcInvoice(inv)
  if (Math.abs(t.total) > 99_999_999_999) errors.push('合計金額が大きすぎます。')
  if (issuerRegistration.trim() !== '' && !/^T\d{13}$/.test(issuerRegistration.trim())) {
    errors.push('登録番号は「T」+数字13桁で入力してください（例: T1234567890123）。')
  }
  return errors
}
