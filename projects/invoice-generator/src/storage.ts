import type { Invoice, Issuer, Item, PriceMode, Rate, Rounding } from './invoice'
import { isValidDate } from './invoice'

const INVOICES_KEY = 'invoice-generator:v1:invoices'
const ISSUER_KEY = 'invoice-generator:v1:issuer'

export const EMPTY_ISSUER: Issuer = { name: '', registrationNumber: '', address: '', contact: '', bank: '' }

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true } catch { return false }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

function sanitizeIssuer(v: unknown): Issuer {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    name: str(o.name, 200), registrationNumber: str(o.registrationNumber, 20),
    address: str(o.address, 500), contact: str(o.contact, 200), bank: str(o.bank, 500),
  }
}

function sanitizeItem(v: unknown): Item | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const quantity = Number(o.quantity)
  const unitPrice = Number(o.unitPrice)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null
  const rate: Rate = o.rate === 8 ? 8 : 10
  return { name: str(o.name, 200), quantity, unit: str(o.unit, 20), unitPrice, rate }
}

/** 取り込んだ1件を検証・無害化。不正なら null。 */
export function sanitizeInvoice(v: unknown): Invoice | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(o.id)) return null
  if (!Array.isArray(o.items) || o.items.length > 500) return null
  const items: Item[] = []
  for (const it of o.items) {
    const s = sanitizeItem(it)
    if (!s) return null
    items.push(s)
  }
  const issueDate = str(o.issueDate, 10)
  if (!isValidDate(issueDate)) return null
  const dueDate = str(o.dueDate, 10)
  const priceMode: PriceMode = o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    id: o.id, number: str(o.number, 64), issueDate, dueDate: isValidDate(dueDate) ? dueDate : '',
    issuer: sanitizeIssuer(o.issuer), customerName: str(o.customerName, 200), items,
    priceMode, rounding, note: str(o.note, 2000), savedAt: str(o.savedAt, 40),
  }
}

export function loadInvoices(): Invoice[] {
  const text = read(INVOICES_KEY)
  if (!text) return []
  try {
    const arr = JSON.parse(text)
    if (!Array.isArray(arr)) return []
    return arr.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
  } catch { return [] }
}

export function saveInvoices(list: Invoice[]): boolean {
  return write(INVOICES_KEY, JSON.stringify(list))
}

export function loadIssuer(): Issuer {
  const text = read(ISSUER_KEY)
  if (!text) return { ...EMPTY_ISSUER }
  try { return sanitizeIssuer(JSON.parse(text)) } catch { return { ...EMPTY_ISSUER } }
}

export function saveIssuer(issuer: Issuer): boolean {
  return write(ISSUER_KEY, JSON.stringify(issuer))
}

/** 同じidは置き換え、新しいものは追加する */
export function mergeInvoices(existing: Invoice[], incoming: Invoice[]): Invoice[] {
  const map = new Map(existing.map((i) => [i.id, i]))
  incoming.forEach((i) => map.set(i.id, i))
  return Array.from(map.values())
}

export function backupToBlob(list: Invoice[], issuer: Issuer): Blob {
  const payload = { app: 'invoice-generator', version: 1, issuer, invoices: list }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
}

export interface ParsedBackup { invoices: Invoice[]; issuer: Issuer | null; skipped: number }

export function parseBackupText(text: string): ParsedBackup {
  const clean = text.replace(/^﻿/, '')
  let data: unknown
  try { data = JSON.parse(clean) } catch { throw new Error('JSONとして読み込めませんでした。') }
  if (!data || typeof data !== 'object' || (data as Record<string, unknown>).app !== 'invoice-generator')
    throw new Error('このアプリのバックアップファイルではありません。')
  const o = data as Record<string, unknown>
  const raw = Array.isArray(o.invoices) ? o.invoices : []
  const invoices = raw.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
  return { invoices, issuer: o.issuer ? sanitizeIssuer(o.issuer) : null, skipped: raw.length - invoices.length }
}
