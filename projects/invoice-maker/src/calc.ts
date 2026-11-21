export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'excl' | 'incl'
export type TaxRate = 10 | 8

export interface LineItem {
  name: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface InvoiceInput {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  customerName: string
  priceMode: PriceMode
  rounding: Rounding
  items: LineItem[]
  note: string
}

export interface IssuerInfo {
  name: string
  postalAddress: string
  registrationNumber: string
  contact: string
  bankInfo: string
}

export interface RateSummary {
  rate: TaxRate
  /** 税率ごとの対象額（税抜） */
  baseYen: number
  taxYen: number
  /** 税率ごとの対象額（税込） */
  grossYen: number
}

export interface InvoiceResult {
  lineAmounts: number[]
  summaries: RateSummary[]
  subtotalYen: number
  taxYen: number
  totalYen: number
}

/** 整数 n / d（d>0）を指定の端数処理で整数にする。整数演算のみなので浮動小数点誤差が出ない。 */
export function divRound(n: number, d: number, mode: Rounding): number {
  if (mode === 'floor') return Math.floor(n / d)
  if (mode === 'ceil') return -Math.floor(-n / d)
  return Math.floor((2 * n + d) / (2 * d))
}

function applyRounding(x: number, mode: Rounding): number {
  // 0.1+0.2 のような浮動小数点誤差を丸めてから端数処理する
  const v = Math.round(x * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.floor(v + 0.5)
}

export function lineAmount(item: LineItem, mode: Rounding): number {
  return applyRounding(item.quantity * item.unitPriceYen, mode)
}

/**
 * 適格請求書の「税率ごとに区分して合計した対象額」と「税率ごとの消費税額」を計算する。
 * 消費税額の端数処理は、請求書1枚につき税率ごとに1回のみ行う。
 */
export function calculateInvoice(input: InvoiceInput): InvoiceResult {
  const lineAmounts = input.items.map((it) => lineAmount(it, input.rounding))
  const rates: TaxRate[] = [10, 8]
  const summaries: RateSummary[] = []
  for (const rate of rates) {
    let sum = 0
    let count = 0
    input.items.forEach((it, i) => {
      if (it.taxRate === rate) {
        sum += lineAmounts[i]
        count++
      }
    })
    if (count === 0) continue
    if (input.priceMode === 'excl') {
      const taxYen = divRound(sum * rate, 100, input.rounding)
      summaries.push({ rate, baseYen: sum, taxYen, grossYen: sum + taxYen })
    } else {
      const taxYen = divRound(sum * rate, 100 + rate, input.rounding)
      summaries.push({ rate, baseYen: sum - taxYen, taxYen, grossYen: sum })
    }
  }
  const subtotalYen = summaries.reduce((a, s) => a + s.baseYen, 0)
  const taxYen = summaries.reduce((a, s) => a + s.taxYen, 0)
  return { lineAmounts, summaries, subtotalYen, taxYen, totalYen: subtotalYen + taxYen }
}

/** 全角数字・全角記号を半角にし、カンマ・空白を除去する */
export function normalizeNumericText(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，、\s　]/g, '')
}

export function parseNumberLoose(s: string): number {
  const t = normalizeNumericText(s)
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}

/** 登録番号（T + 13桁）を正規化する。全角・ハイフン・小文字tを許容。 */
export function normalizeRegistrationNumber(s: string): string {
  const t = s
    .replace(/[Ｔｔ]/g, 'T')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[-－−ー\s　]/g, '')
    .toUpperCase()
  return t
}

export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(s))
}

const MAX_YEN = 1_000_000_000

export function validateInvoice(issuer: IssuerInfo, input: InvoiceInput): string[] {
  const errors: string[] = []
  if (!issuer.name.trim()) errors.push('発行者の氏名または名称を入力してください。')
  if (issuer.registrationNumber.trim() && !isValidRegistrationNumber(issuer.registrationNumber)) {
    errors.push('登録番号は「T」と数字13桁の形式で入力してください（例: T1234567890123）。')
  }
  if (!input.customerName.trim()) errors.push('宛名（請求先）を入力してください。')
  if (!input.issueDate) errors.push('発行日を入力してください。')
  if (input.items.length === 0) errors.push('明細を1行以上入力してください。')
  input.items.forEach((it, i) => {
    const n = i + 1
    if (!it.name.trim()) errors.push(`明細${n}: 品名を入力してください。`)
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) errors.push(`明細${n}: 数量は0より大きい数値にしてください。`)
    if (!Number.isFinite(it.unitPriceYen) || it.unitPriceYen < 0) errors.push(`明細${n}: 単価は0以上の数値にしてください。`)
    if (it.unitPriceYen > MAX_YEN || it.quantity * it.unitPriceYen > MAX_YEN * 10) errors.push(`明細${n}: 金額が大きすぎます。`)
  })
  return errors
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
