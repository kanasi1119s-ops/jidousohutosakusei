import type { LineInput, PriceMode, Rounding } from './calc'

export interface Issuer {
  name: string
  address: string
  registrationNumber: string
  contact: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  subject: string
  lines: LineInput[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
  note: string
  updatedAt: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  nextSeq: number
  invoices: Invoice[]
}

export const emptyIssuer = (): Issuer => ({
  name: '',
  address: '',
  registrationNumber: '',
  contact: '',
  bank: '',
})

export const emptyData = (): AppData => ({
  version: 1,
  issuer: emptyIssuer(),
  nextSeq: 1,
  invoices: [],
})

export function todayString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function makeInvoiceNumber(seq: number, d: Date = new Date()): string {
  return `INV-${d.getFullYear()}-${String(seq).padStart(4, '0')}`
}

export function newInvoice(seq: number, d: Date = new Date()): Invoice {
  return {
    id: `inv-${d.getTime()}-${Math.floor(Math.random() * 1e6)}`,
    number: makeInvoiceNumber(seq, d),
    issueDate: todayString(d),
    dueDate: '',
    clientName: '',
    subject: '',
    lines: [{ name: '', qty: 1, unitPrice: 0, rate: 10 }],
    priceMode: 'exclusive',
    rounding: 'floor',
    withholding: false,
    note: '',
    updatedAt: d.toISOString(),
  }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

function sanitizeInvoice(raw: unknown): Invoice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const linesRaw = Array.isArray(r.lines) ? r.lines.slice(0, 200) : []
  const lines = linesRaw.map((l) => {
    const o = (typeof l === 'object' && l !== null ? l : {}) as Record<string, unknown>
    return {
      name: str(o.name, 200),
      qty: num(o.qty, 1),
      unitPrice: num(o.unitPrice, 0),
      rate: (o.rate === 8 ? 8 : 10) as 8 | 10,
    }
  })
  if (lines.length === 0) lines.push({ name: '', qty: 1, unitPrice: 0, rate: 10 })
  return {
    id: str(r.id, 100) || `inv-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    number: str(r.number, 100),
    issueDate: str(r.issueDate, 20),
    dueDate: str(r.dueDate, 20),
    clientName: str(r.clientName, 200),
    subject: str(r.subject, 200),
    lines,
    priceMode: r.priceMode === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: r.rounding === 'round' || r.rounding === 'ceil' ? r.rounding : 'floor',
    withholding: r.withholding === true,
    note: str(r.note, 2000),
    updatedAt: str(r.updatedAt, 40) || new Date().toISOString(),
  }
}

/** インポートされたJSONを検証して AppData に整える。不正な場合は null */
export function parseAppData(text: string): AppData | null {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || !Array.isArray(r.invoices)) return null
  const iss = (typeof r.issuer === 'object' && r.issuer !== null ? r.issuer : {}) as Record<
    string,
    unknown
  >
  const invoices = r.invoices
    .slice(0, 5000)
    .map(sanitizeInvoice)
    .filter((x): x is Invoice => x !== null)
  return {
    version: 1,
    issuer: {
      name: str(iss.name, 200),
      address: str(iss.address, 500),
      registrationNumber: str(iss.registrationNumber, 50),
      contact: str(iss.contact, 200),
      bank: str(iss.bank, 500),
    },
    nextSeq: Math.max(1, Math.floor(num(r.nextSeq, invoices.length + 1))),
    invoices,
  }
}
