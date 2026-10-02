import type { LineItem, PriceMode, Rounding } from './calc'

export interface Invoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  issuerName: string
  issuerAddress: string
  registrationNumber: string
  clientName: string
  subject: string
  bankInfo: string
  notes: string
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
  items: LineItem[]
}

export const SCHEMA = 'invoice-generator/v1'

export function todayString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyInvoice(): Invoice {
  return {
    invoiceNumber: '',
    issueDate: todayString(),
    dueDate: '',
    issuerName: '',
    issuerAddress: '',
    registrationNumber: '',
    clientName: '',
    subject: '',
    bankInfo: '',
    notes: '',
    priceMode: 'exclusive',
    rounding: 'floor',
    withholding: false,
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
  }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : 0)

/** 読み込んだ任意のJSONを検証して Invoice に正規化する。不正なら null */
export function sanitizeInvoice(raw: unknown): Invoice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.items)) return null
  const base = emptyInvoice()
  const items: LineItem[] = o.items.slice(0, 200).map((it) => {
    const r = (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>
    return { name: str(r.name, 200), quantity: num(r.quantity), unitPrice: num(r.unitPrice), taxRate: r.taxRate === 8 ? 8 : 10 }
  })
  return {
    ...base,
    invoiceNumber: str(o.invoiceNumber, 100),
    issueDate: str(o.issueDate, 10),
    dueDate: str(o.dueDate, 10),
    issuerName: str(o.issuerName, 200),
    issuerAddress: str(o.issuerAddress, 500),
    registrationNumber: str(o.registrationNumber, 30),
    clientName: str(o.clientName, 200),
    subject: str(o.subject, 200),
    bankInfo: str(o.bankInfo, 500),
    notes: str(o.notes, 2000),
    priceMode: o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor',
    withholding: o.withholding === true,
    items: items.length > 0 ? items : base.items,
  }
}
