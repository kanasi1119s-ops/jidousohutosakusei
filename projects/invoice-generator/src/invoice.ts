export type TaxRate = 10 | 8 | 0

export interface InvoiceItem {
  name: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface Client {
  id: string
  name: string
  address: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  clientAddress: string
  items: InvoiceItem[]
  notes: string
  createdAt: number
}

export interface RateGroupTotal {
  taxRate: TaxRate
  subtotalYen: number
  taxYen: number
  totalYen: number
}

export interface InvoiceTotals {
  rateGroups: RateGroupTotal[]
  grandSubtotalYen: number
  grandTaxYen: number
  grandTotalYen: number
}

export function lineAmountYen(item: InvoiceItem): number {
  return Math.round(item.quantity * item.unitPriceYen)
}

/**
 * 適格請求書等保存方式では、消費税額の端数処理は「税率ごとに1回」行うことが求められる
 * （品目ごとに計算して合計してはならない）。ここでは税率ごとの小計に対して四捨五入を1回だけ適用する。
 * 端数処理の方式（四捨五入/切り上げ/切り捨て）は事業者の任意で選択できるため、この既定値は一例であり、
 * 実際の運用では docs/LEGAL.md の免責事項を確認すること。
 */
export function computeInvoiceTotals(items: InvoiceItem[]): InvoiceTotals {
  const rates: TaxRate[] = [10, 8, 0]
  const rateGroups: RateGroupTotal[] = []

  for (const rate of rates) {
    const rateItems = items.filter((item) => item.taxRate === rate)
    if (rateItems.length === 0) continue
    const subtotalYen = rateItems.reduce((sum, item) => sum + lineAmountYen(item), 0)
    const taxYen = rate === 0 ? 0 : Math.round(subtotalYen * (rate / 100))
    rateGroups.push({ taxRate: rate, subtotalYen, taxYen, totalYen: subtotalYen + taxYen })
  }

  const grandSubtotalYen = rateGroups.reduce((sum, g) => sum + g.subtotalYen, 0)
  const grandTaxYen = rateGroups.reduce((sum, g) => sum + g.taxYen, 0)

  return {
    rateGroups,
    grandSubtotalYen,
    grandTaxYen,
    grandTotalYen: grandSubtotalYen + grandTaxYen,
  }
}

export function validateItem(item: InvoiceItem): string[] {
  const errors: string[] = []
  if (!item.name.trim()) errors.push('品目名を入力してください。')
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) errors.push('数量は0より大きい数値を入力してください。')
  if (!Number.isFinite(item.unitPriceYen) || item.unitPriceYen < 0) errors.push('単価は0以上の数値を入力してください。')
  return errors
}

export function validateInvoice(invoice: Pick<Invoice, 'clientName' | 'issueDate' | 'items'>): string[] {
  const errors: string[] = []
  if (!invoice.clientName.trim()) errors.push('取引先名を入力してください。')
  if (!invoice.issueDate) errors.push('発行日を入力してください。')
  if (invoice.items.length === 0) errors.push('品目を1つ以上追加してください。')
  invoice.items.forEach((item, i) => {
    validateItem(item).forEach((e) => errors.push(`品目${i + 1}: ${e}`))
  })
  return errors
}

const REGISTRATION_NUMBER_PATTERN = /^T\d{13}$/

export function validateRegistrationNumber(value: string): string[] {
  if (!value.trim()) return ['適格請求書発行事業者登録番号が未設定です（事業者情報で設定してください）。']
  if (!REGISTRATION_NUMBER_PATTERN.test(value.trim())) {
    return ['登録番号の形式が正しくありません（"T"+13桁の数字、例: T1234567890123）。']
  }
  return []
}
