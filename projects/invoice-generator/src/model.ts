import { MAX_INPUT, type LineItem, type Rounding } from './calc'

export interface Invoice {
  version: 1
  issuerName: string
  issuerRegistration: string
  issuerAddress: string
  bankInfo: string
  customerName: string
  invoiceNumber: string
  issueDate: string // YYYY-MM-DD
  dueDate: string
  rounding: Rounding
  notes: string
  items: LineItem[]
}

export function emptyInvoice(today: string): Invoice {
  return {
    version: 1,
    issuerName: '',
    issuerRegistration: '',
    issuerAddress: '',
    bankInfo: '',
    customerName: '',
    invoiceNumber: 'INV-0001',
    issueDate: today,
    dueDate: '',
    rounding: 'floor',
    notes: '',
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
  }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** インポートされた不明なJSONを検証し、安全な Invoice に整形する。不正なら null。 */
export function sanitizeInvoice(raw: unknown, today: string): Invoice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.items)) return null
  const base = emptyInvoice(today)
  const items: LineItem[] = o.items.slice(0, 200).map((it) => {
    const r = (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>
    const q = Number(r.quantity)
    const p = Number(r.unitPrice)
    return {
      name: str(r.name, 200),
      quantity: Number.isFinite(q) && Math.abs(q) <= MAX_INPUT ? q : 0,
      unitPrice: Number.isFinite(p) && Math.abs(p) <= MAX_INPUT ? p : 0,
      taxRate: r.taxRate === 8 ? 8 : 10,
    }
  })
  const rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    ...base,
    issuerName: str(o.issuerName, 200),
    issuerRegistration: str(o.issuerRegistration, 40),
    issuerAddress: str(o.issuerAddress),
    bankInfo: str(o.bankInfo),
    customerName: str(o.customerName, 200),
    invoiceNumber: str(o.invoiceNumber, 60) || base.invoiceNumber,
    issueDate: str(o.issueDate, 10) || today,
    dueDate: str(o.dueDate, 10),
    rounding,
    notes: str(o.notes),
    items: items.length > 0 ? items : base.items,
  }
}
