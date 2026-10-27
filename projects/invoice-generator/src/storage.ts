import { todayIso } from './format'
import { normalizeRegistrationNumber } from './validate'
import type { AppData, Honorific, Invoice, Issuer, LineItem, PriceMode, RoundingMode, TaxRate } from './types'

const STORAGE_KEY = 'invoice-generator:data:v1'
const MAX_TEXT = 2000
const MAX_ITEMS = 200
const MAX_SAVED = 500

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function emptyIssuer(): Issuer {
  return { name: '', registrationNumber: '', postalCode: '', address: '', phone: '', email: '', bankInfo: '' }
}

export function newItem(): LineItem {
  return { id: newId(), name: '', quantity: 1, unitPrice: 0, taxRate: 10 }
}

export function newInvoice(issuer: Issuer): Invoice {
  const today = todayIso()
  return {
    id: newId(),
    invoiceNumber: '',
    issueDate: today,
    transactionDate: today,
    dueDate: '',
    subject: '',
    issuer: { ...issuer },
    clientName: '',
    honorific: '御中',
    items: [newItem()],
    priceMode: 'exclusive',
    rounding: 'floor',
    withholdingEnabled: false,
    notes: '',
    updatedAt: new Date().toISOString(),
  }
}

export function emptyAppData(): AppData {
  const issuer = emptyIssuer()
  return { version: 1, defaultIssuer: issuer, draft: newInvoice(issuer), saved: [] }
}

function str(v: unknown, field: string, required = false): string {
  if (typeof v !== 'string') {
    if (required) throw new Error(`ファイルの形式が不正です（${field} が文字列ではありません）。`)
    return ''
  }
  return v.slice(0, MAX_TEXT)
}

function num(v: unknown, field: string): number {
  // 未入力（NaN）は JSON 化で null になるため、0として読み戻す
  if (v === null) return 0
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`ファイルの形式が不正です（${field} が数値ではありません）。`)
  return v
}

function oneOf<T extends string | number>(v: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(v as T)) throw new Error(`ファイルの形式が不正です（${field} の値が不正です）。`)
  return v as T
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function sanitizeIssuer(v: unknown): Issuer {
  if (!isRecord(v)) throw new Error('ファイルの形式が不正です（発行者情報）。')
  return {
    name: str(v.name, 'name'),
    registrationNumber: normalizeRegistrationNumber(str(v.registrationNumber, 'registrationNumber')),
    postalCode: str(v.postalCode, 'postalCode'),
    address: str(v.address, 'address'),
    phone: str(v.phone, 'phone'),
    email: str(v.email, 'email'),
    bankInfo: str(v.bankInfo, 'bankInfo'),
  }
}

export function sanitizeInvoice(v: unknown): Invoice {
  if (!isRecord(v)) throw new Error('ファイルの形式が不正です（請求書データ）。')
  if (!Array.isArray(v.items)) throw new Error('ファイルの形式が不正です（items が配列ではありません）。')
  if (v.items.length > MAX_ITEMS) throw new Error(`明細は${MAX_ITEMS}行までです。`)
  const items: LineItem[] = v.items.map((raw, i) => {
    if (!isRecord(raw)) throw new Error(`ファイルの形式が不正です（明細${i + 1}）。`)
    return {
      id: str(raw.id, 'id') || newId(),
      name: str(raw.name, 'name'),
      quantity: num(raw.quantity, 'quantity'),
      unitPrice: num(raw.unitPrice, 'unitPrice'),
      taxRate: oneOf<TaxRate>(raw.taxRate, [0, 8, 10], 'taxRate'),
    }
  })
  return {
    id: str(v.id, 'id') || newId(),
    invoiceNumber: str(v.invoiceNumber, 'invoiceNumber'),
    issueDate: str(v.issueDate, 'issueDate'),
    transactionDate: str(v.transactionDate, 'transactionDate'),
    dueDate: str(v.dueDate, 'dueDate'),
    subject: str(v.subject, 'subject'),
    issuer: sanitizeIssuer(v.issuer),
    clientName: str(v.clientName, 'clientName'),
    honorific: oneOf<Honorific>(v.honorific, ['御中', '様'], 'honorific'),
    items,
    priceMode: oneOf<PriceMode>(v.priceMode, ['exclusive', 'inclusive'], 'priceMode'),
    rounding: oneOf<RoundingMode>(v.rounding, ['floor', 'round', 'ceil'], 'rounding'),
    withholdingEnabled: v.withholdingEnabled === true,
    notes: str(v.notes, 'notes'),
    updatedAt: str(v.updatedAt, 'updatedAt') || new Date().toISOString(),
  }
}

export function sanitizeAppData(v: unknown): AppData {
  if (!isRecord(v) || v.version !== 1) throw new Error('ファイルの形式が不正です（このアプリのバックアップではありません）。')
  if (!Array.isArray(v.saved)) throw new Error('ファイルの形式が不正です（saved が配列ではありません）。')
  if (v.saved.length > MAX_SAVED) throw new Error(`保存済み請求書は${MAX_SAVED}件までです。`)
  return {
    version: 1,
    defaultIssuer: sanitizeIssuer(v.defaultIssuer),
    draft: sanitizeInvoice(v.draft),
    saved: v.saved.map(sanitizeInvoice),
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ストレージが使えない環境（プライベートモード等）でも動作は継続する
  }
}

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return sanitizeAppData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function dataToJsonBlob(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseDataFromJsonText(text: string): AppData {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('ファイルを読み込めませんでした（JSONとして不正です）。')
  }
  return sanitizeAppData(parsed)
}

export function jsonDownloadFileName(date: string = todayIso()): string {
  return `invoice-generator-backup-${date}.json`
}
