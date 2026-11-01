import { emptyIssuer, newId, type Invoice, type Issuer, type Item, type Rounding } from './invoice'

const KEY = 'invoice-maker-jp:v1'

export interface StoreData {
  invoices: Invoice[]
  current: Invoice | null
  lastIssuer: Issuer
}

export const emptyStore = (): StoreData => ({ invoices: [], current: null, lastIssuer: emptyIssuer() })

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function sanitizeIssuer(v: unknown): Issuer {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    name: str(o.name, 200),
    registrationNo: str(o.registrationNo, 20),
    address: str(o.address, 500),
    contact: str(o.contact, 200),
    bank: str(o.bank, 500),
  }
}

/** インポートされた未信頼データを検証・正規化する。不正なら null。 */
export function sanitizeInvoice(v: unknown): Invoice | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.items) || o.items.length > 500) return null
  const items: Item[] = o.items.map((raw) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return { name: str(r.name, 200), qty: num(r.qty), unitPrice: num(r.unitPrice), rate: r.rate === 8 ? 8 : 10 }
  })
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    id: typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId(),
    number: str(o.number, 100),
    issueDate: str(o.issueDate, 10),
    dueDate: str(o.dueDate, 10),
    customerName: str(o.customerName, 200),
    issuer: sanitizeIssuer(o.issuer),
    items,
    rounding,
    notes: str(o.notes, 2000),
  }
}

export function parseStore(json: string): StoreData | null {
  try {
    const o = JSON.parse(json.replace(/^﻿/, ''))
    if (!o || typeof o !== 'object' || !Array.isArray(o.invoices)) return null
    const invoices = o.invoices.map(sanitizeInvoice).filter((x: Invoice | null): x is Invoice => x !== null)
    return { invoices, current: sanitizeInvoice(o.current), lastIssuer: sanitizeIssuer(o.lastIssuer) }
  } catch {
    return null
  }
}

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return parseStore(raw) ?? emptyStore()
  } catch {
    // ストレージ不可（プライベートモード等）の場合は空で続行
  }
  return emptyStore()
}

export function saveStore(data: StoreData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function buildExportJson(data: StoreData): string {
  return JSON.stringify({ app: 'invoice-maker-jp', version: 1, ...data }, null, 2)
}

export function buildExportBlob(data: StoreData): Blob {
  return new Blob([buildExportJson(data)], { type: 'application/json;charset=utf-8' })
}
