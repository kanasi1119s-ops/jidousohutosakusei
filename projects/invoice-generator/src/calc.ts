import type { LineItem, Rounding, TaxRate } from './types'

const FULLWIDTH_OFFSET = 0xfee0

/** 全角数字・全角記号を半角にし、カンマ・空白・円記号を除去して数値化する。解釈できなければ NaN。 */
export function parseNumberInput(raw: string): number {
  const half = raw
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/[，、,\s¥￥円]/g, '')
    .replace(/[－−ー]/g, '-')
  if (half === '' || !/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

/** 適格請求書発行事業者の登録番号（T + 数字13桁）の形式のみを検証する。実在確認は国税庁の公表サイトで行う。 */
export function normalizeRegistrationNumber(raw: string): string {
  return raw
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/[\s-]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(raw: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(raw))
}

/** 整数 numerator / denominator を指定の端数処理で整数化する（符号は絶対値に対して処理して戻す）。 */
function divideRounded(numerator: number, denominator: number, rounding: Rounding): number {
  const sign = numerator < 0 ? -1 : 1
  const n = Math.abs(numerator)
  let q: number
  if (rounding === 'floor') q = Math.floor(n / denominator)
  else if (rounding === 'ceil') q = Math.floor((n + denominator - 1) / denominator)
  else q = Math.floor((n * 2 + denominator) / (denominator * 2))
  return q === 0 ? 0 : sign * q
}

/** 明細金額（税抜）。小数部の円未満は切り捨てる。 */
export function lineAmountYen(item: Pick<LineItem, 'quantity' | 'unitPriceYen'>): number {
  const raw = Math.round(item.quantity * item.unitPriceYen * 1000) / 1000
  const sign = raw < 0 ? -1 : 1
  const v = Math.floor(Math.abs(raw))
  return v === 0 ? 0 : sign * v
}

export function consumptionTaxYen(subtotalYen: number, rate: TaxRate, rounding: Rounding): number {
  return divideRounded(subtotalYen * rate, 100, rounding)
}

/** 源泉徴収税額（復興特別所得税を含む）。100万円以下は10.21%、超過分は20.42%。円未満切り捨て。 */
export function withholdingTaxYen(paymentYen: number): number {
  if (paymentYen <= 0) return 0
  if (paymentYen <= 1_000_000) return Math.floor((paymentYen * 1021) / 10000)
  return Math.floor(((paymentYen - 1_000_000) * 2042) / 10000) + 102_100
}

export interface RateSummary {
  rate: TaxRate
  subtotalYen: number
  taxYen: number
}

export interface InvoiceTotals {
  byRate: RateSummary[]
  subtotalYen: number
  taxYen: number
  withholdingYen: number
  totalYen: number
}

export function computeTotals(items: LineItem[], rounding: Rounding, withholding: boolean): InvoiceTotals {
  const byRate: RateSummary[] = ([10, 8] as TaxRate[])
    .map((rate) => {
      const subtotalYen = items
        .filter((i) => i.taxRate === rate)
        .reduce((sum, i) => sum + lineAmountYen(i), 0)
      return { rate, subtotalYen, taxYen: consumptionTaxYen(subtotalYen, rate, rounding) }
    })
    .filter((s) => s.subtotalYen !== 0)
  const subtotalYen = byRate.reduce((s, r) => s + r.subtotalYen, 0)
  const taxYen = byRate.reduce((s, r) => s + r.taxYen, 0)
  const withholdingYen = withholding ? withholdingTaxYen(subtotalYen) : 0
  return { byRate, subtotalYen, taxYen, withholdingYen, totalYen: subtotalYen + taxYen - withholdingYen }
}

export function formatYen(n: number): string {
  return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('ja-JP')
}

export function nextInvoiceNumber(existing: string[], date: Date = new Date()): string {
  const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-`
  let max = 0
  for (const n of existing) {
    if (n.startsWith(prefix)) {
      const seq = Number(n.slice(prefix.length))
      if (Number.isInteger(seq) && seq > max) max = seq
    }
  }
  return prefix + String(max + 1).padStart(3, '0')
}

export interface ValidationIssue {
  message: string
}

export function validateInvoiceForIssue(args: {
  issuerName: string
  registrationNumber: string
  clientName: string
  issueDate: string
  items: LineItem[]
}): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!args.issuerName.trim()) issues.push({ message: '発行者の氏名または名称を入力してください。' })
  if (!args.registrationNumber.trim()) {
    issues.push({ message: '登録番号が未入力です（適格請求書として発行する場合は必須）。' })
  } else if (!isValidRegistrationNumber(args.registrationNumber)) {
    issues.push({ message: '登録番号は「T」+数字13桁の形式で入力してください。' })
  }
  if (!args.clientName.trim()) issues.push({ message: '請求先の氏名または名称を入力してください。' })
  if (!args.issueDate) issues.push({ message: '請求日（取引年月日）を入力してください。' })
  if (args.items.length === 0) issues.push({ message: '明細を1行以上入力してください。' })
  args.items.forEach((it, idx) => {
    if (!it.name.trim()) issues.push({ message: `明細${idx + 1}行目: 品名を入力してください。` })
    if (!Number.isFinite(it.quantity) || !Number.isFinite(it.unitPriceYen)) {
      issues.push({ message: `明細${idx + 1}行目: 数量・単価は数値で入力してください。` })
    }
  })
  return issues
}
