import type { LineItem, PriceMode, Rounding, TaxRate } from './calc'

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
  customerName: string
  subject: string
  notes: string
  items: LineItem[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
  updatedAt: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  invoices: Invoice[]
}

const STORAGE_KEY = 'invoice-maker:data:v1'

export const EMPTY_ISSUER: Issuer = { name: '', address: '', registrationNumber: '', contact: '', bank: '' }

export function emptyData(): AppData {
  return { version: 1, issuer: { ...EMPTY_ISSUER }, invoices: [] }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

function sanitizeItem(raw: unknown): LineItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const qty = Number(r.quantity)
  const price = Number(r.unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return null
  const rate = r.taxRate === 8 || r.taxRate === 0 ? (r.taxRate as TaxRate) : 10
  return { name: str(r.name, 200), quantity: qty, unitPrice: price, taxRate: rate }
}

function sanitizeInvoice(raw: unknown): Invoice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.items)) return null
  const items = r.items.map(sanitizeItem).filter((x): x is LineItem => x !== null).slice(0, 200)
  return {
    id: str(r.id, 64) || String(Date.now()) + Math.random().toString(36).slice(2, 8),
    number: str(r.number, 64),
    issueDate: str(r.issueDate, 10),
    dueDate: str(r.dueDate, 10),
    customerName: str(r.customerName, 200),
    subject: str(r.subject, 200),
    notes: str(r.notes),
    items,
    priceMode: r.priceMode === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: r.rounding === 'round' || r.rounding === 'ceil' ? (r.rounding as Rounding) : 'floor',
    withholding: r.withholding === true,
    updatedAt: str(r.updatedAt, 40),
  }
}

/** 外部から読み込んだデータ（localStorage / インポートファイル）を検証・正規化する。不正なら例外 */
export function sanitizeAppData(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null) throw new Error('ファイルの形式が不正です。')
  const r = raw as Record<string, unknown>
  if (r.version !== 1) throw new Error('対応していないバージョンのファイルです。')
  const iss = (typeof r.issuer === 'object' && r.issuer !== null ? r.issuer : {}) as Record<string, unknown>
  const invoices = Array.isArray(r.invoices)
    ? r.invoices.map(sanitizeInvoice).filter((x): x is Invoice => x !== null).slice(0, 1000)
    : []
  return {
    version: 1,
    issuer: {
      name: str(iss.name, 200),
      address: str(iss.address, 400),
      registrationNumber: str(iss.registrationNumber, 32),
      contact: str(iss.contact, 200),
      bank: str(iss.bank, 400),
    },
    invoices,
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ストレージ使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    return sanitizeAppData(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseDataFromJsonText(text: string): AppData {
  // 先頭のBOMがあれば除去してから解析する
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(t)
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  return sanitizeAppData(parsed)
}

/** 既存の請求書番号と重複しない次の番号（INV-YYYYMMDD-NNN）を返す */
export function nextInvoiceNumber(dateIso: string, existing: string[]): string {
  const used = new Set(existing)
  const ymd = dateIso.replace(/-/g, '')
  for (let seq = 1; seq < 100000; seq++) {
    const candidate = `INV-${ymd}-${String(seq).padStart(3, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `INV-${ymd}-${Date.now()}`
}
