import {
  MAX_ITEMS,
  MAX_QUANTITY,
  MAX_UNIT_PRICE,
  newInvoice,
  type Honorific,
  type Invoice,
  type LineItem,
  type Rounding,
} from './calc'

const DRAFT_KEY = 'invoice-generator:draft:v1'
const SAVED_KEY = 'invoice-generator:saved:v1'

export interface SavedInvoice {
  id: string
  savedAt: string
  invoice: Invoice
}

export interface BackupFile {
  app: 'invoice-generator'
  version: 1
  draft: Invoice
  saved: SavedInvoice[]
}

const TEXT_FIELDS = [
  'issuerName',
  'issuerRegistrationNo',
  'issuerAddress',
  'issuerContact',
  'clientName',
  'invoiceNo',
  'issueDate',
  'dueDate',
  'bankInfo',
  'notes',
] as const

function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function sanitizeItem(raw: unknown): LineItem {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    description: str(o.description, 200),
    quantity: num(o.quantity, 0, MAX_QUANTITY, 1),
    unitPriceYen: num(o.unitPriceYen, -MAX_UNIT_PRICE, MAX_UNIT_PRICE, 0),
    taxRate: o.taxRate === 8 ? 8 : 10,
  }
}

/** 外部（localStorage・インポートファイル）由来の値を検証して安全な Invoice に整える。 */
export function sanitizeInvoice(raw: unknown): Invoice {
  if (typeof raw !== 'object' || raw === null) throw new Error('請求書データの形式が不正です。')
  const o = raw as Record<string, unknown>
  const base = newInvoice()
  const inv: Invoice = { ...base }
  for (const k of TEXT_FIELDS) inv[k] = str(o[k], k === 'notes' || k === 'bankInfo' ? 2000 : 200)
  if (inv.issueDate === '') inv.issueDate = base.issueDate
  inv.honorific = (['御中', '様', ''] as Honorific[]).includes(o.honorific as Honorific)
    ? (o.honorific as Honorific)
    : '御中'
  inv.rounding = (['floor', 'round', 'ceil'] as Rounding[]).includes(o.rounding as Rounding)
    ? (o.rounding as Rounding)
    : 'floor'
  inv.withholding = o.withholding === true
  const items = Array.isArray(o.items) ? o.items.slice(0, MAX_ITEMS).map(sanitizeItem) : []
  inv.items = items.length > 0 ? items : base.items
  return inv
}

export function saveDraft(invoice: Invoice): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(invoice))
  } catch {
    // ストレージが使えなくても致命的にしない
  }
}

export function loadDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? sanitizeInvoice(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function loadSaved(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? sanitizeSaved(arr) : []
  } catch {
    return []
  }
}

function sanitizeSaved(arr: unknown[]): SavedInvoice[] {
  const out: SavedInvoice[] = []
  for (const e of arr) {
    try {
      const o = e as Record<string, unknown>
      out.push({
        id: str(o.id, 64) || String(Date.now() + out.length),
        savedAt: str(o.savedAt, 40),
        invoice: sanitizeInvoice(o.invoice),
      })
    } catch {
      // 壊れた1件は読み飛ばす
    }
  }
  return out
}

export function persistSaved(list: SavedInvoice[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list))
  } catch {
    // 同上
  }
}

export function buildBackup(draft: Invoice, saved: SavedInvoice[]): BackupFile {
  return { app: 'invoice-generator', version: 1, draft, saved }
}

export function backupToBlob(backup: BackupFile): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseBackupText(text: string): BackupFile {
  const clean = text.replace(/^﻿/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルを読み取れませんでした（JSONの形式が不正です）。')
  }
  const o = parsed as Record<string, unknown>
  if (!o || o.app !== 'invoice-generator' || !o.draft) {
    throw new Error('このアプリのバックアップファイルではありません。')
  }
  return {
    app: 'invoice-generator',
    version: 1,
    draft: sanitizeInvoice(o.draft),
    saved: Array.isArray(o.saved) ? sanitizeSaved(o.saved) : [],
  }
}
