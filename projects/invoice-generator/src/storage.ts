import { emptyIssuer, type Invoice, type Issuer, type LineItem, type RoundingMode, type TaxRate } from './calc'

export interface AppData {
  version: 1
  defaultIssuer: Issuer
  invoices: Invoice[]
}

const KEY = 'invoice-generator:v1'

export function emptyData(): AppData {
  return { version: 1, defaultIssuer: emptyIssuer(), invoices: [] }
}

function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function sanitizeIssuer(v: unknown): Issuer {
  const o = (v ?? {}) as Record<string, unknown>
  return { name: str(o.name, 200), registrationNumber: str(o.registrationNumber, 50), address: str(o.address), bank: str(o.bank) }
}

function sanitizeItem(v: unknown): LineItem {
  const o = (v ?? {}) as Record<string, unknown>
  const q = typeof o.quantity === 'number' && Number.isFinite(o.quantity) ? o.quantity : 0
  const p = typeof o.unitPriceYen === 'number' && Number.isFinite(o.unitPriceYen) ? o.unitPriceYen : 0
  const rate: TaxRate = o.taxRate === 8 ? 8 : 10
  return { description: str(o.description, 500), quantity: q, unitPriceYen: p, taxRate: rate }
}

export function sanitizeInvoice(v: unknown): Invoice | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const id = str(o.id, 100)
  if (id === '') return null
  const rounding: RoundingMode = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  const items = Array.isArray(o.items) ? o.items.slice(0, 500).map(sanitizeItem) : []
  return {
    id,
    number: str(o.number, 100),
    issueDate: str(o.issueDate, 10),
    dueDate: str(o.dueDate, 10),
    qualified: o.qualified === true,
    issuer: sanitizeIssuer(o.issuer),
    clientName: str(o.clientName, 200),
    items,
    rounding,
    notes: str(o.notes),
    updatedAt: str(o.updatedAt, 40),
  }
}

/** バックアップJSONを検証して AppData にする。不正なら Error を投げる。 */
export function parseBackup(text: string): AppData {
  const body = text.replace(/^﻿/, '')
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  const o = raw as Record<string, unknown> | null
  if (typeof o !== 'object' || o === null || o.version !== 1 || !Array.isArray(o.invoices)) {
    throw new Error('このアプリのバックアップファイルではありません。')
  }
  const invoices = o.invoices.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
  return { version: 1, defaultIssuer: sanitizeIssuer(o.defaultIssuer), invoices }
}

export function serializeBackup(data: AppData): string {
  return JSON.stringify(data, null, 2) + '\n'
}

export function mergeInvoices(base: Invoice[], incoming: Invoice[]): Invoice[] {
  const map = new Map(base.map((i) => [i.id, i]))
  for (const inv of incoming) map.set(inv.id, inv)
  return Array.from(map.values())
}

export function loadData(): AppData {
  try {
    const text = localStorage.getItem(KEY)
    if (text) return parseBackup(text)
  } catch {
    // 破損・アクセス不可の場合は空データで継続
  }
  return emptyData()
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(KEY, serializeBackup(data))
    return true
  } catch {
    return false
  }
}
