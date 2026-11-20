import type { Item, Rounding, TaxRate } from './calc'
import { isValidRegNoFormat } from './calc'

export interface Invoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  issuerName: string
  issuerRegNo: string
  issuerAddress: string
  clientName: string
  items: Item[]
  rounding: Rounding
  note: string
  bankInfo: string
}

export function emptyInvoice(today: string = todayString()): Invoice {
  return {
    invoiceNumber: '',
    issueDate: today,
    dueDate: '',
    issuerName: '',
    issuerRegNo: '',
    issuerAddress: '',
    clientName: '',
    items: [{ description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
    rounding: 'floor',
    note: '',
    bankInfo: '',
  }
}

export function todayString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 適格請求書の必須記載事項の不足を警告として返す（法的助言ではなく目安）。 */
export function validateInvoice(inv: Invoice): string[] {
  const w: string[] = []
  if (!inv.issuerName.trim()) w.push('発行者の氏名または名称が未入力です。')
  if (!inv.issuerRegNo.trim()) {
    w.push('登録番号が未入力です。未入力のままでは適格請求書にはなりません。')
  } else if (!isValidRegNoFormat(inv.issuerRegNo)) {
    w.push('登録番号の形式が不正です（「T」+数字13桁）。')
  }
  if (!inv.issueDate) w.push('取引年月日（発行日）が未入力です。')
  if (!inv.clientName.trim()) w.push('宛名（受領者の氏名または名称）が未入力です。')
  if (!inv.items.some((it) => it.description.trim() && it.unitPriceYen !== 0)) {
    w.push('取引内容（品名・金額）が未入力です。')
  }
  return w
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

export function sanitizeInvoice(raw: unknown): Invoice {
  if (typeof raw !== 'object' || raw === null) throw new Error('請求書データの形式が不正です。')
  const r = raw as Record<string, unknown>
  const items: Item[] = Array.isArray(r.items)
    ? r.items.slice(0, 200).map((x) => {
        const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
        const q = typeof o.quantity === 'number' && Number.isFinite(o.quantity) ? o.quantity : 1
        const p = typeof o.unitPriceYen === 'number' && Number.isFinite(o.unitPriceYen) ? o.unitPriceYen : 0
        const t: TaxRate = o.taxRate === 8 ? 8 : 10
        return { description: str(o.description, 200), quantity: q, unitPriceYen: p, taxRate: t }
      })
    : []
  const rounding: Rounding = r.rounding === 'round' || r.rounding === 'ceil' ? r.rounding : 'floor'
  return {
    invoiceNumber: str(r.invoiceNumber, 50),
    issueDate: str(r.issueDate, 10),
    dueDate: str(r.dueDate, 10),
    issuerName: str(r.issuerName, 200),
    issuerRegNo: str(r.issuerRegNo, 30),
    issuerAddress: str(r.issuerAddress, 300),
    clientName: str(r.clientName, 200),
    items: items.length ? items : emptyInvoice().items,
    rounding,
    note: str(r.note),
    bankInfo: str(r.bankInfo),
  }
}

export interface SavedInvoice {
  id: string
  savedAt: string
  invoice: Invoice
}

export interface Backup {
  schema: 'invoice-maker/v1'
  current: Invoice
  saved: SavedInvoice[]
}

export function buildBackup(current: Invoice, saved: SavedInvoice[]): Backup {
  return { schema: 'invoice-maker/v1', current, saved }
}

export function parseBackup(text: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  const p = parsed as Record<string, unknown>
  if (!p || p.schema !== 'invoice-maker/v1') {
    throw new Error('このアプリのバックアップファイルではありません。')
  }
  const saved = Array.isArray(p.saved)
    ? p.saved.slice(0, 500).map((s, i) => {
        const o = (s ?? {}) as Record<string, unknown>
        return {
          id: str(o.id, 60) || `imported-${i}`,
          savedAt: str(o.savedAt, 40),
          invoice: sanitizeInvoice(o.invoice),
        }
      })
    : []
  return { schema: 'invoice-maker/v1', current: sanitizeInvoice(p.current), saved }
}
