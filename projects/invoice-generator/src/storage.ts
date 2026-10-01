import {
  MAX_ITEMS,
  LIMIT,
  newId,
  newInvoice,
  type Honorific,
  type Invoice,
  type Item,
  type PriceMode,
  type Rounding,
  type TaxRate,
} from './calc'

const STORAGE_KEY = 'invoice-generator:state:v1'
const MAX_SAVED = 200

export interface AppState {
  current: Invoice
  saved: Invoice[]
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-LIMIT, Math.min(LIMIT, v)) : fallback
}

function oneOf<T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

function sanitizeItem(raw: unknown): Item {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    name: str(r.name, 200),
    quantity: num(r.quantity, 1),
    unitPrice: num(r.unitPrice, 0),
    taxRate: oneOf<TaxRate>(r.taxRate, [10, 8, 0], 10),
  }
}

/** 外部（localStorage・インポートファイル）から来た値を、型の保証された請求書に整える。 */
export function sanitizeInvoice(raw: unknown): Invoice {
  if (!raw || typeof raw !== 'object') throw new Error('請求書データの形式が不正です。')
  const r = raw as Record<string, unknown>
  const issuer = (r.issuer && typeof r.issuer === 'object' ? r.issuer : {}) as Record<string, unknown>
  const items = Array.isArray(r.items) ? r.items.slice(0, MAX_ITEMS).map(sanitizeItem) : []
  const base = newInvoice()
  return {
    id: str(r.id, 80) || newId(),
    number: str(r.number, 60),
    issueDate: /^\d{4}-\d{2}-\d{2}$/.test(str(r.issueDate, 10)) ? str(r.issueDate, 10) : base.issueDate,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(str(r.dueDate, 10)) ? str(r.dueDate, 10) : '',
    issuer: {
      name: str(issuer.name, 200),
      address: str(issuer.address, 400),
      registrationNumber: str(issuer.registrationNumber, 40),
    },
    clientName: str(r.clientName, 200),
    honorific: oneOf<Honorific>(r.honorific, ['御中', '様', ''], '御中'),
    items: items.length > 0 ? items : base.items,
    priceMode: oneOf<PriceMode>(r.priceMode, ['exclusive', 'inclusive'], 'exclusive'),
    rounding: oneOf<Rounding>(r.rounding, ['floor', 'round', 'ceil'], 'floor'),
    notes: str(r.notes, 2000),
    bank: str(r.bank, 1000),
    updatedAt: num(r.updatedAt, Date.now()),
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ストレージが使えない環境（プライベートモード等）でも致命的にしない
  }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const saved = Array.isArray(parsed.saved) ? parsed.saved.slice(0, MAX_SAVED).map(sanitizeInvoice) : []
    return { current: sanitizeInvoice(parsed.current), saved }
  } catch {
    return null
  }
}

/** 保存済み一覧へ追加/更新（同一idは上書き）。新しい順に並べる。 */
export function upsertSaved(saved: Invoice[], inv: Invoice): Invoice[] {
  const rest = saved.filter((s) => s.id !== inv.id)
  return [{ ...inv, updatedAt: Date.now() }, ...rest].slice(0, MAX_SAVED)
}

export function invoicesToJsonBlob(invoices: Invoice[]): Blob {
  const json = JSON.stringify({ app: 'invoice-generator', version: 1, invoices }, null, 2)
  return new Blob([json], { type: 'application/json;charset=utf-8' })
}

/** エクスポートJSON（BOMが付いていても可）を請求書の配列に戻す。 */
export function parseImport(text: string): Invoice[] {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('JSONとして読み込めませんでした。このツールでエクスポートしたファイルを選んでください。')
  }
  const list = (parsed as { invoices?: unknown })?.invoices
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('インポートできる請求書が含まれていません。')
  }
  return list.slice(0, MAX_SAVED).map(sanitizeInvoice)
}

export function exportFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoice-generator-backup-${y}-${m}-${d}.json`
}
