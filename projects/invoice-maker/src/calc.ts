export type TaxRate = 0 | 8 | 10
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface Line {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  taxRate: TaxRate
}

export interface CalcInput {
  lines: Line[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
}

export interface RateSummary {
  rate: TaxRate
  /** 明細金額の合計（入力モードに従い、税抜または税込） */
  gross: number
  /** 税抜の対価合計 */
  net: number
  tax: number
  /** 税込の対価合計 */
  total: number
}

export interface CalcResult {
  perRate: RateSummary[]
  net: number
  tax: number
  total: number
  withholdingAmount: number
  payable: number
  lineAmounts: number[]
}

export const TAX_RATES: TaxRate[] = [10, 8, 0]

const MAX_LINE_AMOUNT = 1e12
const WITHHOLDING_THRESHOLD = 1_000_000

/** 全角数字・カンマ・通貨記号を許容して数値に変換する。解釈できなければ 0。 */
export function parseNumber(text: string): number {
  const normalized = text
    .normalize('NFKC')
    .replace(/[−ー‐]/g, '-')
    .replace(/[,\s¥円]/g, '')
  if (normalized === '' || !/^-?\d*\.?\d*$/.test(normalized)) return 0
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function signedRound(value: number, mode: Rounding): number {
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  let r: number
  if (mode === 'floor') r = Math.floor(abs)
  else if (mode === 'ceil') r = Math.ceil(abs)
  else r = Math.floor(abs + 0.5)
  return sign * r
}

/** 整数同士の割り算を、符号に対して対称に端数処理する（誤差の出ない整数演算）。 */
export function divideRound(numerator: number, denominator: number, mode: Rounding): number {
  const sign = numerator < 0 ? -1 : 1
  const n = Math.abs(numerator)
  const q = Math.floor(n / denominator)
  const rem = n - q * denominator
  let r = q
  if (rem > 0) {
    if (mode === 'ceil') r = q + 1
    else if (mode === 'round' && rem * 2 >= denominator) r = q + 1
  }
  return sign * r
}

export function lineAmount(line: Line): number {
  const raw = Number((line.quantity * line.unitPrice).toFixed(6))
  const amount = signedRound(raw, 'round')
  return Math.max(-MAX_LINE_AMOUNT, Math.min(MAX_LINE_AMOUNT, amount))
}

/** 源泉徴収税額（報酬・料金等、復興特別所得税込み）。100万円以下 10.21%、超過分 20.42%、1円未満切捨て。 */
export function withholdingTax(net: number): number {
  if (net <= 0) return 0
  if (net <= WITHHOLDING_THRESHOLD) return Math.floor((net * 1021) / 10000)
  return (
    Math.floor((WITHHOLDING_THRESHOLD * 1021) / 10000) +
    Math.floor(((net - WITHHOLDING_THRESHOLD) * 2042) / 10000)
  )
}

export function calculate(input: CalcInput): CalcResult {
  const lineAmounts = input.lines.map(lineAmount)
  const perRate: RateSummary[] = TAX_RATES.map((rate) => {
    const gross = input.lines.reduce(
      (sum, line, i) => (line.taxRate === rate ? sum + lineAmounts[i] : sum),
      0,
    )
    let tax = 0
    let net = gross
    let total = gross
    if (rate > 0) {
      if (input.priceMode === 'exclusive') {
        tax = divideRound(gross * rate, 100, input.rounding)
        total = gross + tax
      } else {
        tax = divideRound(gross * rate, 100 + rate, input.rounding)
        net = gross - tax
      }
    }
    return { rate, gross, net, tax, total }
  })

  const net = perRate.reduce((s, r) => s + r.net, 0)
  const tax = perRate.reduce((s, r) => s + r.tax, 0)
  const total = perRate.reduce((s, r) => s + r.total, 0)
  const withholdingAmount = input.withholding ? withholdingTax(net) : 0
  return { perRate, net, tax, total, withholdingAmount, payable: total - withholdingAmount, lineAmounts }
}

/** 適格請求書発行事業者の登録番号（T + 数字13桁）の形式チェック。実在確認は国税庁の公表サイトで行う。 */
export function isValidRegistrationNumber(value: string): boolean {
  return /^T\d{13}$/.test(value)
}

/** 全角英数字を半角にして大文字化・空白除去する（登録番号の入力ゆれ吸収）。 */
export function normalizeRegistrationNumber(value: string): string {
  return value.normalize('NFKC').replace(/\s/g, '').toUpperCase()
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '¥' + Math.abs(n).toLocaleString('ja-JP')
}
