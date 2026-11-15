import type { LineItem, Rounding, TaxRate } from './calc'
import { MAX_ITEMS, MAX_QTY, MAX_UNIT_PRICE } from './calc'

export interface Settings {
  issuerName: string
  registrationNumber: string
  issuerAddress: string
  issuerTel: string
  issuerEmail: string
  bankInfo: string
  rounding: Rounding
  dueDays: number
  numberPrefix: string
  nextSeq: number
}

export interface Invoice {
  id: string
  number: string
  issueDate: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD or ''
  clientName: string
  honorific: '御中' | '様'
  subject: string
  items: LineItem[]
  withholding: boolean
  note: string
  updatedAt: string // ISO
}

export interface AppData {
  settings: Settings
  invoices: Invoice[]
}

export const BACKUP_APP = 'invoice-maker'
export const BACKUP_VERSION = 1

export function defaultSettings(): Settings {
  return {
    issuerName: '',
    registrationNumber: '',
    issuerAddress: '',
    issuerTel: '',
    issuerEmail: '',
    bankInfo: '',
    rounding: 'floor',
    dueDays: 30,
    numberPrefix: 'INV-',
    nextSeq: 1,
  }
}

export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

export function todayString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD に日数を加算（タイムゾーンの影響を受けないようUTCで計算） */
export function addDays(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return ''
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + days * 86400000
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function isValidDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

export function formatJaDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

export function formatInvoiceNumber(s: Settings): string {
  return `${s.numberPrefix}${pad(s.nextSeq, 4)}`
}

export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function emptyItem(): LineItem {
  return { name: '', qty: 1, unitPrice: 0, taxRate: 10 }
}

export function newInvoice(settings: Settings, today: string = todayString()): Invoice {
  return {
    id: newId(),
    number: formatInvoiceNumber(settings),
    issueDate: today,
    dueDate: addDays(today, settings.dueDays),
    clientName: '',
    honorific: '御中',
    subject: '',
    items: [emptyItem()],
    withholding: false,
    note: '',
    updatedAt: new Date().toISOString(),
  }
}

// ---- サニタイズ（インポート・復元データは信用しない） ----

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback
}

function sanitizeItem(v: unknown): LineItem | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const rate = o.taxRate === 8 || o.taxRate === 0 ? (o.taxRate as TaxRate) : 10
  const unit = num(o.unitPrice, -MAX_UNIT_PRICE, MAX_UNIT_PRICE, 0)
  return {
    name: str(o.name, 200),
    qty: Math.round(num(o.qty, 0, MAX_QTY, 1) * 1000) / 1000,
    unitPrice: Math.round(unit),
    taxRate: rate,
  }
}

export function sanitizeInvoice(v: unknown): Invoice | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id === '' || o.id.length > 100) return null
  const items = Array.isArray(o.items)
    ? o.items
        .slice(0, MAX_ITEMS)
        .map(sanitizeItem)
        .filter((x): x is LineItem => x !== null)
    : []
  const issue = typeof o.issueDate === 'string' && isValidDateString(o.issueDate) ? o.issueDate : todayString()
  return {
    id: o.id,
    number: str(o.number, 50),
    issueDate: issue,
    dueDate: typeof o.dueDate === 'string' && isValidDateString(o.dueDate) ? o.dueDate : '',
    clientName: str(o.clientName, 200),
    honorific: o.honorific === '様' ? '様' : '御中',
    subject: str(o.subject, 200),
    items: items.length > 0 ? items : [emptyItem()],
    withholding: o.withholding === true,
    note: str(o.note, 2000),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt.slice(0, 40) : new Date().toISOString(),
  }
}

export function sanitizeSettings(v: unknown): Settings {
  const d = defaultSettings()
  if (typeof v !== 'object' || v === null) return d
  const o = v as Record<string, unknown>
  return {
    issuerName: str(o.issuerName, 200),
    registrationNumber: str(o.registrationNumber, 20),
    issuerAddress: str(o.issuerAddress, 500),
    issuerTel: str(o.issuerTel, 50),
    issuerEmail: str(o.issuerEmail, 200),
    bankInfo: str(o.bankInfo, 500),
    rounding: o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor',
    dueDays: Math.round(num(o.dueDays, 0, 365, d.dueDays)),
    numberPrefix: str(o.numberPrefix, 20),
    nextSeq: Math.round(num(o.nextSeq, 1, 99_999_999, 1)),
  }
}

export function sanitizeAppData(v: unknown): AppData {
  const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  const invoices = Array.isArray(o.invoices)
    ? o.invoices.map(sanitizeInvoice).filter((x): x is Invoice => x !== null)
    : []
  return { settings: sanitizeSettings(o.settings), invoices }
}

// ---- バックアップ（JSON） ----

export function buildBackupJson(data: AppData): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, ...data }, null, 2)
}

export function buildBackupBlob(data: AppData): Blob {
  return new Blob([buildBackupJson(data)], { type: 'application/json;charset=utf-8' })
}

export function parseBackupText(text: string): AppData {
  const clean = text.replace(/^\uFEFF/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('ファイルを読み込めませんでした。JSON形式ではありません。')
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { app?: unknown }).app !== BACKUP_APP) {
    throw new Error('このアプリのバックアップファイルではありません。')
  }
  const version = (parsed as { version?: unknown }).version
  if (typeof version !== 'number' || version > BACKUP_VERSION) {
    throw new Error('対応していないバージョンのバックアップファイルです。')
  }
  return sanitizeAppData(parsed)
}

/** 同じidは上書き、新しいidは追加（設定はインポート側を採用） */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const map = new Map(current.invoices.map((i) => [i.id, i]))
  for (const inv of incoming.invoices) map.set(inv.id, inv)
  const nextSeq = Math.max(current.settings.nextSeq, incoming.settings.nextSeq)
  return { settings: { ...incoming.settings, nextSeq }, invoices: Array.from(map.values()) }
}
