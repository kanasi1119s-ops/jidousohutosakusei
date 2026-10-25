export type TaxRate = 10 | 8 | 0
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface InvoiceItem {
  description: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface Party {
  name: string
  registrationNumber: string
  address: string
  contact: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  deliveryDate: string
  seller: Party
  clientName: string
  items: InvoiceItem[]
  priceMode: PriceMode
  rounding: Rounding
  bankInfo: string
  note: string
}

export interface RateSummary {
  taxRate: TaxRate
  /** 税抜の対象額合計 */
  taxableYen: number
  taxYen: number
  /** 税込の対象額合計 */
  grossYen: number
}

export interface InvoiceTotals {
  byRate: RateSummary[]
  subtotalYen: number
  taxYen: number
  totalYen: number
  lineAmountsYen: number[]
}

export const TAX_RATES: TaxRate[] = [10, 8, 0]

/** 全角数字・全角記号を半角にし、カンマ・空白を取り除く */
export function normalizeNumberText(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー―]/g, '-')
    .replace(/[．]/g, '.')
    .replace(/[,，、\s]/g, '')
}

export function parseNumberInput(text: string): number {
  const n = normalizeNumberText(text)
  if (n === '' || !/^-?\d+(\.\d+)?$/.test(n)) return NaN
  return Number(n)
}

/** 分数 n/d を端数処理して整数にする（n, d は整数、d>0）。浮動小数点誤差を避けるため整数演算のみ使う */
export function divideRounded(n: number, d: number, mode: Rounding): number {
  const sign = n < 0 ? -1 : 1
  const a = Math.abs(n)
  let q: number
  if (mode === 'floor') q = Math.floor(a / d)
  else if (mode === 'ceil') q = Math.ceil(a / d)
  else q = Math.floor((2 * a + d) / (2 * d))
  return sign * q
}

export function lineAmountYen(item: InvoiceItem, mode: Rounding): number {
  // 数量が小数でも誤差が出ないよう、1e6倍した整数で扱う
  const scaled = Math.round(item.quantity * 1e6) * item.unitPriceYen
  return divideRounded(scaled, 1e6, mode)
}

export function calcTotals(invoice: Pick<Invoice, 'items' | 'priceMode' | 'rounding'>): InvoiceTotals {
  const { priceMode, rounding } = invoice
  const lineAmountsYen = invoice.items.map((it) => lineAmountYen(it, rounding))
  const byRate: RateSummary[] = []

  for (const rate of TAX_RATES) {
    let sum = 0
    let count = 0
    invoice.items.forEach((it, i) => {
      if (it.taxRate === rate) {
        sum += lineAmountsYen[i]
        count++
      }
    })
    if (count === 0) continue
    // 端数処理は税率ごとに請求書1枚につき1回
    if (priceMode === 'exclusive') {
      const taxYen = divideRounded(sum * rate, 100, rounding)
      byRate.push({ taxRate: rate, taxableYen: sum, taxYen, grossYen: sum + taxYen })
    } else {
      const taxYen = divideRounded(sum * rate, 100 + rate, rounding)
      byRate.push({ taxRate: rate, taxableYen: sum - taxYen, taxYen, grossYen: sum })
    }
  }

  const subtotalYen = byRate.reduce((s, r) => s + r.taxableYen, 0)
  const taxYen = byRate.reduce((s, r) => s + r.taxYen, 0)
  return { byRate, subtotalYen, taxYen, totalYen: subtotalYen + taxYen, lineAmountsYen }
}

export function normalizeRegistrationNumber(text: string): string {
  return text
    .replace(/[Ｔｔ]/g, 'T')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s-－ー]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}

const MAX_ITEMS = 100
const MAX_YEN = 9_999_999_999

export function validateInvoice(inv: Invoice): string[] {
  const errors: string[] = []
  if (!inv.seller.name.trim()) errors.push('発行者の氏名または名称を入力してください')
  if (inv.seller.registrationNumber.trim() && !isValidRegistrationNumber(inv.seller.registrationNumber)) {
    errors.push('登録番号は「T」＋数字13桁で入力してください（例: T1234567890123）')
  }
  if (!inv.clientName.trim()) errors.push('請求先の氏名または名称を入力してください')
  if (!inv.number.trim()) errors.push('請求書番号を入力してください')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate)) errors.push('発行日を入力してください')
  if (inv.items.length === 0) errors.push('明細を1行以上入力してください')
  if (inv.items.length > MAX_ITEMS) errors.push(`明細は${MAX_ITEMS}行までです`)
  inv.items.forEach((it, i) => {
    const row = `明細${i + 1}行目`
    if (!it.description.trim()) errors.push(`${row}: 品名・内容を入力してください`)
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) errors.push(`${row}: 数量は0より大きい数値にしてください`)
    if (!Number.isFinite(it.unitPriceYen) || !Number.isInteger(it.unitPriceYen)) {
      errors.push(`${row}: 単価は整数（円）で入力してください（値引きはマイナス）`)
    } else if (Math.abs(it.unitPriceYen) > MAX_YEN) {
      errors.push(`${row}: 単価が大きすぎます`)
    }
  })
  if (errors.length === 0) {
    const t = calcTotals(inv)
    if (!Number.isSafeInteger(t.totalYen) || Math.abs(t.totalYen) > MAX_YEN * 10) {
      errors.push('合計金額が大きすぎます')
    }
  }
  return errors
}

export function formatYen(n: number): string {
  return `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('ja-JP')}`
}

export function emptyInvoice(today: string, id: string): Invoice {
  return {
    id,
    number: `INV-${today.replace(/-/g, '')}-001`,
    issueDate: today,
    dueDate: '',
    deliveryDate: '',
    seller: { name: '', registrationNumber: '', address: '', contact: '' },
    clientName: '',
    items: [{ description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
    priceMode: 'exclusive',
    rounding: 'floor',
    bankInfo: '',
    note: '',
  }
}
