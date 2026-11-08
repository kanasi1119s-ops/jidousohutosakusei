import { MAX_ITEMS, type Invoice, type LineItem } from './model'

const KEY = 'invoice-maker:data:v1'
export const APP_ID = 'invoice-maker'

export interface AppData {
  invoices: Invoice[]
  draft: Invoice | null
}

function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** 外部入力（localStorage/インポートファイル）を検証して安全な Invoice に整える。不正なら null。 */
export function sanitizeInvoice(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.items)) return null
  const items: LineItem[] = []
  for (const it of r.items.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') return null
    const o = it as Record<string, unknown>
    if (typeof o.quantity !== 'number' || typeof o.unitPrice !== 'number') return null
    if (!Number.isFinite(o.quantity) || !Number.isFinite(o.unitPrice)) return null
    items.push({
      name: str(o.name, 200),
      quantity: o.quantity,
      unitPrice: o.unitPrice,
      taxRate: o.taxRate === 8 ? 8 : 10,
    })
  }
  return {
    invoiceNumber: str(r.invoiceNumber, 60),
    issueDate: str(r.issueDate, 10),
    dueDate: str(r.dueDate, 10),
    issuerName: str(r.issuerName, 200),
    issuerRegistrationNumber: str(r.issuerRegistrationNumber, 30),
    issuerAddress: str(r.issuerAddress, 400),
    issuerBank: str(r.issuerBank, 400),
    clientName: str(r.clientName, 200),
    subject: str(r.subject, 200),
    notes: str(r.notes, 2000),
    priceMode: r.priceMode === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: r.rounding === 'round' || r.rounding === 'ceil' ? r.rounding : 'floor',
    items,
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { invoices: [], draft: null }
    const p = JSON.parse(raw)
    const invoices = Array.isArray(p.invoices)
      ? p.invoices.map(sanitizeInvoice).filter((x: Invoice | null): x is Invoice => x !== null)
      : []
    return { invoices, draft: sanitizeInvoice(p.draft) }
  } catch {
    return { invoices: [], draft: null }
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 保存不可（プライベートモード等）でも致命的にしない
  }
}

export function backupToJsonBlob(invoices: Invoice[]): Blob {
  const body = JSON.stringify({ app: APP_ID, version: 1, invoices }, null, 2)
  return new Blob([body], { type: 'application/json;charset=utf-8' })
}

export function parseBackup(text: string): Invoice[] {
  const clean = text.replace(/^﻿/, '')
  let p: unknown
  try {
    p = JSON.parse(clean)
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  const o = p as { app?: unknown; invoices?: unknown }
  if (!o || o.app !== APP_ID || !Array.isArray(o.invoices)) {
    throw new Error('このアプリのバックアップファイルではありません。')
  }
  const out: Invoice[] = []
  for (const x of o.invoices) {
    const inv = sanitizeInvoice(x)
    if (!inv) throw new Error('バックアップ内に不正な請求書データがあります。')
    out.push(inv)
  }
  return out
}

/** 同じ請求書番号は上書き、無ければ追加。 */
export function upsertInvoice(list: Invoice[], inv: Invoice): Invoice[] {
  const i = list.findIndex((x) => x.invoiceNumber === inv.invoiceNumber)
  if (i >= 0) {
    const copy = list.slice()
    copy[i] = inv
    return copy
  }
  return [...list, inv]
}

/** 次の請求書番号の提案（末尾の数字を+1。無ければ INV-0001 形式）。 */
export function suggestNextNumber(list: Invoice[]): string {
  let best: { prefix: string; n: number; width: number } | null = null
  for (const inv of list) {
    const m = /^(.*?)(\d+)$/.exec(inv.invoiceNumber)
    if (m && (!best || Number(m[2]) >= best.n)) best = { prefix: m[1], n: Number(m[2]), width: m[2].length }
  }
  if (!best) return 'INV-0001'
  return best.prefix + String(best.n + 1).padStart(best.width, '0')
}
