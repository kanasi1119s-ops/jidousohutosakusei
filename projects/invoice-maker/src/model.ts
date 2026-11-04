import type { LineItem, Rounding, TaxRate } from './calc'

export interface Issuer {
  name: string
  address: string
  phone: string
  email: string
  registrationNumber: string
  bankInfo: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  honorific: string
  clientAddress: string
  subject: string
  items: LineItem[]
  rounding: Rounding
  withholding: boolean
  notes: string
  savedAt: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  draft: Invoice
  invoices: Invoice[]
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function todayString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyItem(): LineItem {
  return { id: newId(), description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }
}

export function emptyInvoice(): Invoice {
  const today = todayString()
  return {
    id: newId(),
    number: '',
    issueDate: today,
    dueDate: '',
    clientName: '',
    honorific: '御中',
    clientAddress: '',
    subject: '',
    items: [emptyItem()],
    rounding: 'floor',
    withholding: false,
    notes: '',
    savedAt: '',
  }
}

export function emptyIssuer(): Issuer {
  return { name: '', address: '', phone: '', email: '', registrationNumber: '', bankInfo: '' }
}

export function emptyData(): AppData {
  return { version: 1, issuer: emptyIssuer(), draft: emptyInvoice(), invoices: [] }
}

const RATES: TaxRate[] = [10, 8, 0]
const ROUNDINGS: Rounding[] = ['floor', 'round', 'ceil']

function str(v: unknown, max = 5000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function sanitizeItem(raw: unknown): LineItem {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const q = typeof o.quantity === 'number' && Number.isFinite(o.quantity) ? o.quantity : 0
  const p = typeof o.unitPriceYen === 'number' && Number.isFinite(o.unitPriceYen) ? o.unitPriceYen : 0
  const rate = RATES.includes(o.taxRate as TaxRate) ? (o.taxRate as TaxRate) : 10
  return { id: str(o.id, 100) || newId(), description: str(o.description, 500), quantity: q, unitPriceYen: p, taxRate: rate }
}

export function sanitizeInvoice(raw: unknown): Invoice {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = emptyInvoice()
  const items = Array.isArray(o.items) ? o.items.slice(0, 200).map(sanitizeItem) : []
  return {
    id: str(o.id, 100) || base.id,
    number: str(o.number, 100),
    issueDate: str(o.issueDate, 20),
    dueDate: str(o.dueDate, 20),
    clientName: str(o.clientName, 200),
    honorific: str(o.honorific, 20),
    clientAddress: str(o.clientAddress, 500),
    subject: str(o.subject, 300),
    items: items.length > 0 ? items : [emptyItem()],
    rounding: ROUNDINGS.includes(o.rounding as Rounding) ? (o.rounding as Rounding) : 'floor',
    withholding: o.withholding === true,
    notes: str(o.notes),
    savedAt: str(o.savedAt, 40),
  }
}

export function sanitizeIssuer(raw: unknown): Issuer {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    name: str(o.name, 200),
    address: str(o.address, 500),
    phone: str(o.phone, 50),
    email: str(o.email, 200),
    registrationNumber: str(o.registrationNumber, 30),
    bankInfo: str(o.bankInfo, 1000),
  }
}

/** JSON テキストから AppData を復元する。形式が不正なら Error を投げる。 */
export function parseDataFromJsonText(text: string): AppData {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error('インポートしたファイルがJSON形式ではありません。')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('インポートしたファイルの形式が不正です。')
  const o = parsed as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.invoices) || typeof o.issuer !== 'object') {
    throw new Error('インポートしたファイルの形式が不正です（このツールのバックアップファイルではありません）。')
  }
  return {
    version: 1,
    issuer: sanitizeIssuer(o.issuer),
    draft: sanitizeInvoice(o.draft),
    invoices: o.invoices.slice(0, 2000).map(sanitizeInvoice),
  }
}
