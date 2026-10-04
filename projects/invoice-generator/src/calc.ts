export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'
export type Honorific = '御中' | '様' | ''

export interface LineItem {
  description: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface Invoice {
  issuerName: string
  issuerRegistrationNo: string
  issuerAddress: string
  issuerContact: string
  clientName: string
  honorific: Honorific
  invoiceNo: string
  issueDate: string
  dueDate: string
  items: LineItem[]
  rounding: Rounding
  withholding: boolean
  bankInfo: string
  notes: string
}

export interface RateSummary {
  rate: TaxRate
  subtotalYen: number
  taxYen: number
}

export interface InvoiceResult {
  lineAmounts: number[]
  summaries: RateSummary[]
  subtotalYen: number
  taxYen: number
  totalYen: number
  withholdingYen: number
  payableYen: number
}

export const MAX_ITEMS = 50
export const MAX_UNIT_PRICE = 99_999_999
export const MAX_QUANTITY = 99_999

const FULLWIDTH_OFFSET = 0xfee0

/** 全角数字・全角カンマ/ピリオド・円記号・空白を許容して数値に変換する。解釈できなければ null。 */
export function parseNumberInput(raw: string): number | null {
  let s = ''
  for (const ch of raw) {
    const code = ch.codePointAt(0)!
    if (code >= 0xff10 && code <= 0xff19) s += String.fromCodePoint(code - FULLWIDTH_OFFSET)
    else if (ch === '，' || ch === ',' || ch === '¥' || ch === '￥' || ch === '円' || /\s/.test(ch)) continue
    else if (ch === '．') s += '.'
    else if (ch === '－' || ch === '−' || ch === 'ー') s += '-'
    else s += ch
  }
  if (s === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差（例: 0.29*100 = 28.999999999999996）を丸めてから端数処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function lineAmount(item: LineItem, rounding: Rounding): number {
  return applyRounding(item.quantity * item.unitPriceYen, rounding)
}

/** 税額 = 税率ごとの税抜合計 × 税率（1請求書につき税率ごとに1回だけ端数処理）。整数演算で誤差を避ける。 */
export function taxForSubtotal(subtotalYen: number, rate: TaxRate, rounding: Rounding): number {
  const n = subtotalYen * rate
  const q = Math.floor(n / 100)
  const r = n - q * 100
  if (rounding === 'floor' || r === 0) return q
  if (rounding === 'ceil') return q + 1
  return r * 2 >= 100 ? q + 1 : q
}

/** 報酬・料金等の源泉徴収税額（復興特別所得税込み: 100万円以下 10.21%、超過分 20.42%）。1円未満切り捨て。 */
export function withholdingTax(baseYen: number): number {
  if (baseYen <= 0) return 0
  if (baseYen <= 1_000_000) return Math.floor((baseYen * 1021) / 10000)
  return Math.floor(102_100 + ((baseYen - 1_000_000) * 2042) / 10000)
}

export function computeInvoice(invoice: Invoice): InvoiceResult {
  const lineAmounts = invoice.items.map((it) => lineAmount(it, invoice.rounding))
  const rates: TaxRate[] = [10, 8]
  const summaries: RateSummary[] = rates
    .map((rate) => {
      const subtotalYen = invoice.items.reduce(
        (sum, it, i) => (it.taxRate === rate ? sum + lineAmounts[i] : sum),
        0,
      )
      return { rate, subtotalYen, taxYen: taxForSubtotal(subtotalYen, rate, invoice.rounding) }
    })
    .filter((s) => invoice.items.some((it) => it.taxRate === s.rate))

  const subtotalYen = summaries.reduce((a, s) => a + s.subtotalYen, 0)
  const taxYen = summaries.reduce((a, s) => a + s.taxYen, 0)
  const totalYen = subtotalYen + taxYen
  const withholdingYen = invoice.withholding ? withholdingTax(subtotalYen) : 0
  return {
    lineAmounts,
    summaries,
    subtotalYen,
    taxYen,
    totalYen,
    withholdingYen,
    payableYen: totalYen - withholdingYen,
  }
}

export function isValidRegistrationNo(value: string): boolean {
  return /^T\d{13}$/.test(value)
}

/** 全角のTや数字を半角に正規化する（登録番号入力用）。 */
export function normalizeRegistrationNo(value: string): string {
  let s = ''
  for (const ch of value.trim()) {
    const code = ch.codePointAt(0)!
    if ((code >= 0xff10 && code <= 0xff19) || (code >= 0xff21 && code <= 0xff3a))
      s += String.fromCodePoint(code - FULLWIDTH_OFFSET)
    else s += ch
  }
  return s.toUpperCase()
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}

export function formatJaDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
}

export function emptyItem(): LineItem {
  return { description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }
}

export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function newInvoice(date: Date = new Date()): Invoice {
  return {
    issuerName: '',
    issuerRegistrationNo: '',
    issuerAddress: '',
    issuerContact: '',
    clientName: '',
    honorific: '御中',
    invoiceNo: '',
    issueDate: todayIso(date),
    dueDate: '',
    items: [emptyItem()],
    rounding: 'floor',
    withholding: false,
    bankInfo: '',
    notes: '',
  }
}
