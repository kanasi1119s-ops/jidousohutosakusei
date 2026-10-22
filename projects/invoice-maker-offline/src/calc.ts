export type RoundingMode = 'floor' | 'round' | 'ceil'
export type TaxRate = 10 | 8 | 0

export const TAX_RATES: TaxRate[] = [10, 8, 0]
export const MAX_LINES = 100
const MAX_LINE_AMOUNT = 1_000_000_000_000n // 1兆円
const MAX_QUANTITY_MILLI = 1_000_000_000n // 100万
const MAX_UNIT_PRICE_MILLI = 1_000_000_000_000n // 10億円

export interface LineInput {
  description: string
  quantity: string
  unitPrice: string
  taxRate: TaxRate
}

export type LineResult =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; amount: number }

export interface RateBreakdown {
  rate: TaxRate
  subtotal: number
  tax: number
}

export interface InvoiceCalc {
  lines: LineResult[]
  byRate: RateBreakdown[]
  subtotal: number
  tax: number
  total: number
  withholding: number
  payable: number
  errors: string[]
}

/** 全角数字・全角記号などを半角に正規化し、カンマと空白を除去する */
export function normalizeNumberText(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[,，、\s]/g, '')
    .replace(/[－−ー‐]/g, '-')
}

/** 小数3桁までの数値文字列を「1000倍した整数」にする。不正なら null */
export function parseMilli(text: string): bigint | null {
  const s = normalizeNumberText(text)
  const m = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(s)
  if (!m) return null
  const frac = (m[3] ?? '').padEnd(3, '0')
  const v = BigInt(m[2] + frac)
  return m[1] === '-' ? -v : v
}

export function formatMilli(v: bigint): string {
  const neg = v < 0n
  const abs = neg ? -v : v
  const intPart = abs / 1000n
  const frac = (abs % 1000n).toString().padStart(3, '0').replace(/0+$/, '')
  const intText = intPart.toLocaleString('ja-JP')
  return (neg ? '-' : '') + intText + (frac ? '.' + frac : '')
}

/** 非負の n/d を指定モードで整数化する */
function roundDivAbs(n: bigint, d: bigint, mode: RoundingMode): bigint {
  const q = n / d
  const r = n % d
  if (r === 0n) return q
  if (mode === 'floor') return q
  if (mode === 'ceil') return q + 1n
  return r * 2n >= d ? q + 1n : q
}

/** 符号付きの n/d。切捨て・切上げは「絶対値」に対して行う（0方向への切捨て） */
export function roundDiv(n: bigint, d: bigint, mode: RoundingMode): bigint {
  if (n < 0n) return -roundDivAbs(-n, d, mode)
  return roundDivAbs(n, d, mode)
}

export function calcLineAmount(
  quantity: string,
  unitPrice: string,
  mode: RoundingMode,
): LineResult {
  const q = parseMilli(quantity)
  const u = parseMilli(unitPrice)
  if (q === null) return { status: 'error', message: '数量は数値（小数3桁まで）で入力してください' }
  if (u === null) return { status: 'error', message: '単価は数値（小数3桁まで）で入力してください' }
  if ((q < 0n ? -q : q) > MAX_QUANTITY_MILLI) {
    return { status: 'error', message: '数量が大きすぎます（100万以下）' }
  }
  if ((u < 0n ? -u : u) > MAX_UNIT_PRICE_MILLI) {
    return { status: 'error', message: '単価が大きすぎます（10億円以下）' }
  }
  const amount = roundDiv(q * u, 1_000_000n, mode)
  if ((amount < 0n ? -amount : amount) > MAX_LINE_AMOUNT) {
    return { status: 'error', message: '金額が大きすぎます' }
  }
  return { status: 'ok', amount: Number(amount) }
}

/** 源泉徴収税額（報酬・料金）。100万円以下は10.21%、超過分は20.42%、1円未満切捨て */
export function calcWithholding(baseYen: number): number {
  if (!Number.isFinite(baseYen) || baseYen <= 0) return 0
  const base = BigInt(Math.trunc(baseYen))
  const limit = 1_000_000n
  const low = base < limit ? base : limit
  const high = base > limit ? base - limit : 0n
  return Number((low * 1021n + high * 2042n) / 10000n)
}

export function computeInvoice(
  items: LineInput[],
  mode: RoundingMode,
  withholdingEnabled: boolean,
): InvoiceCalc {
  const errors: string[] = []
  if (items.length > MAX_LINES) errors.push(`明細は${MAX_LINES}行までです`)

  const sums = new Map<TaxRate, bigint>()
  const lines: LineResult[] = items.slice(0, MAX_LINES).map((it, i) => {
    if (it.description.trim() === '' && it.unitPrice.trim() === '') return { status: 'empty' }
    const r = calcLineAmount(it.quantity, it.unitPrice, mode)
    if (r.status === 'error') errors.push(`${i + 1}行目: ${r.message}`)
    if (r.status === 'ok') sums.set(it.taxRate, (sums.get(it.taxRate) ?? 0n) + BigInt(r.amount))
    return r
  })

  // 適格請求書: 税額は税率ごとに請求書1枚につき1回だけ端数処理する
  const byRate: RateBreakdown[] = TAX_RATES.filter((r) => sums.has(r)).map((rate) => {
    const subtotal = sums.get(rate) as bigint
    const tax = roundDiv(subtotal * BigInt(rate), 100n, mode)
    return { rate, subtotal: Number(subtotal), tax: Number(tax) }
  })

  const subtotal = byRate.reduce((a, b) => a + b.subtotal, 0)
  const tax = byRate.reduce((a, b) => a + b.tax, 0)
  const total = subtotal + tax
  const withholding = withholdingEnabled ? calcWithholding(subtotal) : 0
  return { lines, byRate, subtotal, tax, total, withholding, payable: total - withholding, errors }
}
