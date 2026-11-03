import type { Invoice } from './calc'

const KEY = 'invoice-maker:v1'
const PROFILE_KEY = 'invoice-maker:profile:v1'

export interface Profile {
  issuerName: string
  issuerAddress: string
  registrationNo: string
  bankInfo: string
}

export function newInvoice(today: string = new Date().toISOString().slice(0, 10)): Invoice {
  return {
    id: 'inv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    invoiceNo: '',
    issueDate: today,
    dueDate: '',
    issuerName: '',
    issuerAddress: '',
    registrationNo: '',
    clientName: '',
    honorific: '御中',
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
    rounding: 'floor',
    note: '',
    bankInfo: '',
    updatedAt: new Date().toISOString(),
  }
}

export function loadAll(): Invoice[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return sanitizeList(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveAll(list: Invoice[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* 容量超過・プライベートモード等 */
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* noop */
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** インポートされた外部JSONを検証・正規化する（不正値は安全な既定値に置換） */
export function sanitizeInvoice(v: unknown): Invoice | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const base = newInvoice()
  const items = Array.isArray(o.items) ? o.items : []
  return {
    id: str(o.id) || base.id,
    invoiceNo: str(o.invoiceNo),
    issueDate: str(o.issueDate),
    dueDate: str(o.dueDate),
    issuerName: str(o.issuerName),
    issuerAddress: str(o.issuerAddress),
    registrationNo: str(o.registrationNo),
    clientName: str(o.clientName),
    honorific: str(o.honorific) || '御中',
    items: items.slice(0, 200).map((it) => {
      const i = (it ?? {}) as Record<string, unknown>
      const rate = i.taxRate === 8 || i.taxRate === 0 ? i.taxRate : 10
      return { name: str(i.name), quantity: num(i.quantity), unitPrice: num(i.unitPrice), taxRate: rate as 10 | 8 | 0 }
    }),
    rounding: o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor',
    note: str(o.note),
    bankInfo: str(o.bankInfo),
    updatedAt: str(o.updatedAt) || base.updatedAt,
  }
}

export function sanitizeList(v: unknown): Invoice[] {
  if (!Array.isArray(v)) return []
  return v.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
}

export function exportJson(list: Invoice[]): string {
  return JSON.stringify({ app: 'invoice-maker', version: 1, invoices: list }, null, 2)
}

export function parseImport(text: string): Invoice[] {
  const clean = text.replace(/^﻿/, '')
  const data = JSON.parse(clean) as { invoices?: unknown }
  return sanitizeList(data && typeof data === 'object' ? data.invoices : null)
}
