import type { Invoice, InvoiceItem, Party, PriceMode, Rounding, TaxRate } from './calc'

const KEY = 'invoice-maker:v1'
const MAX_IMPORT_INVOICES = 1000

export interface AppData {
  invoices: Invoice[]
}

export function emptyData(): AppData {
  return { invoices: [] }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)

function sanitizeParty(v: unknown): Party {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    name: str(o.name, 200),
    registrationNumber: str(o.registrationNumber, 40),
    address: str(o.address, 500),
    contact: str(o.contact, 200),
  }
}

function sanitizeItem(v: unknown): InvoiceItem {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const rate = o.taxRate === 8 || o.taxRate === 0 ? (o.taxRate as TaxRate) : 10
  return { description: str(o.description, 300), quantity: num(o.quantity), unitPriceYen: num(o.unitPriceYen), taxRate: rate }
}

/** 外部から読み込んだ値（localStorage / インポートファイル）を型どおりの安全な値に整える */
export function sanitizeInvoice(v: unknown): Invoice | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  const items = Array.isArray(o.items) ? o.items.slice(0, 100).map(sanitizeItem) : []
  const priceMode: PriceMode = o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    id: str(o.id, 100),
    number: str(o.number, 100),
    issueDate: str(o.issueDate, 10),
    dueDate: str(o.dueDate, 10),
    deliveryDate: str(o.deliveryDate, 10),
    seller: sanitizeParty(o.seller),
    clientName: str(o.clientName, 200),
    items,
    priceMode,
    rounding,
    bankInfo: str(o.bankInfo, 500),
    note: str(o.note, 2000),
  }
}

export function sanitizeData(v: unknown): AppData {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const list = Array.isArray(o.invoices) ? o.invoices.slice(0, MAX_IMPORT_INVOICES) : []
  const invoices = list.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
  return { invoices }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    return sanitizeData(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function exportJson(data: AppData): string {
  return JSON.stringify({ app: 'invoice-maker', version: 1, ...data }, null, 2)
}

export function parseImportedJson(text: string): AppData {
  const stripped = text.replace(/^﻿/, '')
  const parsed = JSON.parse(stripped)
  if (!parsed || typeof parsed !== 'object' || (parsed as Record<string, unknown>).app !== 'invoice-maker') {
    throw new Error('請求書メーカーのバックアップファイルではありません')
  }
  return sanitizeData(parsed)
}

export function upsertInvoice(data: AppData, inv: Invoice): AppData {
  const idx = data.invoices.findIndex((x) => x.id === inv.id)
  const invoices = data.invoices.slice()
  if (idx >= 0) invoices[idx] = inv
  else invoices.unshift(inv)
  return { invoices }
}
