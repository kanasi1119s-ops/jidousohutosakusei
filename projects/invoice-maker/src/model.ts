export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'
export type TaxRate = 10 | 8

export interface LineItem {
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface Invoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  issuerName: string
  issuerRegistrationNumber: string
  issuerAddress: string
  issuerBank: string
  clientName: string
  subject: string
  notes: string
  priceMode: PriceMode
  rounding: Rounding
  items: LineItem[]
}

export const MAX_ITEMS = 100
export const MAX_AMOUNT = 9_999_999_999

/** 全角数字・全角記号を半角に直す（登録番号や金額の入力ゆれ対策）。 */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
}

export function normalizeRegistrationNumber(s: string): string {
  return toHalfWidth(s).replace(/[\s-]/g, '').toUpperCase()
}

export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(s))
}

export function parseNumber(s: string): number {
  const t = toHalfWidth(s).replace(/,/g, '').trim()
  if (t === '') return NaN
  return Number(t)
}

export function emptyInvoice(today: string): Invoice {
  return {
    invoiceNumber: '',
    issueDate: today,
    dueDate: '',
    issuerName: '',
    issuerRegistrationNumber: '',
    issuerAddress: '',
    issuerBank: '',
    clientName: '',
    subject: '',
    notes: '',
    priceMode: 'exclusive',
    rounding: 'floor',
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
  }
}

export function validateInvoice(inv: Invoice): string[] {
  const errors: string[] = []
  if (!inv.issuerName.trim()) errors.push('発行者の名称を入力してください。')
  if (inv.issuerRegistrationNumber.trim() && !isValidRegistrationNumber(inv.issuerRegistrationNumber)) {
    errors.push('登録番号は「T」+数字13桁の形式で入力してください。')
  }
  if (!inv.clientName.trim()) errors.push('請求先の名称を入力してください。')
  if (!inv.issueDate) errors.push('発行日を入力してください。')
  if (!inv.invoiceNumber.trim()) errors.push('請求書番号を入力してください。')
  if (inv.items.length === 0) errors.push('明細を1行以上入力してください。')
  if (inv.items.length > MAX_ITEMS) errors.push(`明細は${MAX_ITEMS}行までです。`)
  inv.items.forEach((it, i) => {
    const n = i + 1
    if (!it.name.trim()) errors.push(`明細${n}: 品名を入力してください。`)
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) errors.push(`明細${n}: 数量は0より大きい数値にしてください。`)
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0 || Math.abs(it.unitPrice) > MAX_AMOUNT) {
      errors.push(`明細${n}: 単価は0以上${MAX_AMOUNT.toLocaleString('ja-JP')}以下の数値にしてください。`)
    }
    if (it.taxRate !== 10 && it.taxRate !== 8) errors.push(`明細${n}: 税率は10%または8%です。`)
  })
  return errors
}
