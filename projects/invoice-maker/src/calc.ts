export type Rounding = 'floor' | 'round' | 'ceil'
export type TaxRate = 10 | 8 | 0

export interface Item {
  name: string
  qty: string
  unitPrice: string
  rate: TaxRate
}

export interface RateSummary {
  rate: TaxRate
  subtotal: number
  tax: number
}

export interface Totals {
  lines: number[]
  /** 入力が不正または範囲外（数量±100万・単価±10億超）で0円扱いになった明細の添字（空行は含まない） */
  invalid: number[]
  byRate: RateSummary[]
  subtotal: number
  tax: number
  total: number
  withholding: number
  payable: number
}

/** 全角数字・カンマ・円記号などを許容して数値化する。解釈できなければ null。 */
export function parseNumber(input: string): number | null {
  const s = input
    .normalize('NFKC')
    .replace(/[,\s円¥]/g, '')
    .replace(/[−ー‐]/g, '-')
  if (s === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差（例: 0.1*3）を避けるため、小数第6位で丸めてから端数処理する
  const v = Math.round(value * 1e6) / 1e6
  const r = mode === 'floor' ? Math.floor(v) : mode === 'ceil' ? Math.ceil(v) : Math.round(v)
  return r === 0 ? 0 : r
}

/** 源泉徴収税額（報酬・料金等）: 100万円以下 10.21%、超過分 20.42%。税抜金額を基準とする。 */
export function withholdingTax(base: number): number {
  if (base <= 0) return 0
  const low = Math.min(base, 1_000_000) * 0.1021
  const high = Math.max(base - 1_000_000, 0) * 0.2042
  return Math.floor(Math.round((low + high) * 1e6) / 1e6)
}

const MAX_QTY = 1_000_000
const MAX_PRICE = 1_000_000_000

export function calcTotals(
  items: Item[],
  rounding: Rounding,
  withholding: boolean,
): Totals {
  const invalid: number[] = []
  const lines = items.map((it, i) => {
    const q = parseNumber(it.qty)
    const p = parseNumber(it.unitPrice)
    if (q === null || p === null || Math.abs(q) > MAX_QTY || Math.abs(p) > MAX_PRICE) {
      if (it.unitPrice.trim() !== '' || it.name.trim() !== '') invalid.push(i)
      return 0
    }
    return applyRounding(q * p, rounding)
  })
  const rates: TaxRate[] = [10, 8, 0]
  const byRate: RateSummary[] = rates
    .map((rate) => {
      const subtotal = items.reduce((acc, it, i) => (it.rate === rate ? acc + lines[i] : acc), 0)
      // 適格請求書では税率ごとに1回の端数処理
      const tax = applyRounding((subtotal * rate) / 100, rounding)
      return { rate, subtotal, tax }
    })
    .filter((r) => r.subtotal !== 0 || r.tax !== 0)
  const subtotal = byRate.reduce((a, r) => a + r.subtotal, 0)
  const tax = byRate.reduce((a, r) => a + r.tax, 0)
  const total = subtotal + tax
  const wh = withholding ? withholdingTax(subtotal) : 0
  return { lines, invalid, byRate, subtotal, tax, total, withholding: wh, payable: total - wh }
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}¥${Math.abs(n).toLocaleString('en-US')}`
}

/** 登録番号の形式チェック（T + 数字13桁）。全角入力は半角化して返す。 */
export function normalizeRegNo(input: string): string {
  return input.normalize('NFKC').replace(/\s/g, '').toUpperCase()
}
export function isValidRegNo(input: string): boolean {
  return /^T\d{13}$/.test(normalizeRegNo(input))
}
