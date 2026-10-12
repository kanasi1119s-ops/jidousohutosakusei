import {
  MAX_ITEMS,
  MAX_QUANTITY,
  MAX_UNIT_PRICE_YEN,
  type CalcOptions,
  type LineItem,
  type PriceMode,
  type RoundingMode,
  type TaxRate,
} from './calc'
import { newId, todayIso } from './util'

export interface Issuer {
  name: string
  registrationNumber: string
  address: string
  contact: string
}

export interface Invoice {
  id: string
  updatedAt: string
  issuer: Issuer
  clientName: string
  honorific: '御中' | '様'
  number: string
  issueDate: string
  dueDate: string
  items: LineItem[]
  options: CalcOptions
  bank: string
  notes: string
}

export interface Backup {
  app: 'invoice-maker'
  version: 1
  issuer: Issuer
  invoices: Invoice[]
}

export const EMPTY_ISSUER: Issuer = { name: '', registrationNumber: '', address: '', contact: '' }

export function newItem(): LineItem {
  return { id: newId(), name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }
}

export function newInvoice(issuer: Issuer = EMPTY_ISSUER, number?: string): Invoice {
  const today = todayIso()
  return {
    id: newId(),
    updatedAt: new Date().toISOString(),
    issuer: { ...issuer },
    clientName: '',
    honorific: '御中',
    number: number ?? `INV-${today.replace(/-/g, '')}-001`,
    issueDate: today,
    dueDate: '',
    items: [newItem()],
    options: { priceMode: 'exclusive', rounding: 'floor', withholding: false },
    bank: '',
    notes: '',
  }
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function sanitizeIssuer(v: unknown): Issuer {
  const o = isObj(v) ? v : {}
  return {
    name: str(o.name, 100),
    registrationNumber: str(o.registrationNumber, 20),
    address: str(o.address, 300),
    contact: str(o.contact, 200),
  }
}

function sanitizeItem(v: unknown): LineItem {
  if (!isObj(v)) throw new Error('明細の形式が不正です。')
  const q = v.quantity
  const p = v.unitPriceYen
  if (typeof q !== 'number' || !Number.isFinite(q) || q < 0 || q > MAX_QUANTITY) {
    throw new Error('明細の数量が不正です（0以上9,999.999以下の数値）。')
  }
  if (typeof p !== 'number' || !Number.isInteger(p) || Math.abs(p) > MAX_UNIT_PRICE_YEN) {
    throw new Error('明細の単価が不正です（絶対値999,999,999以下の整数）。')
  }
  const rate = v.taxRate
  if (rate !== 10 && rate !== 8 && rate !== 0) throw new Error('明細の税率が不正です（10, 8, 0 のいずれか）。')
  return {
    id: typeof v.id === 'string' && v.id !== '' ? v.id.slice(0, 64) : newId(),
    name: str(v.name, 200),
    quantity: Math.round(q * 1000) / 1000,
    unitPriceYen: p,
    taxRate: rate as TaxRate,
  }
}

/** 保存データ／インポートデータを検証・正規化する。不正なら例外を投げる。 */
export function sanitizeInvoice(v: unknown): Invoice {
  if (!isObj(v)) throw new Error('請求書データの形式が不正です。')
  if (!Array.isArray(v.items) || v.items.length < 1 || v.items.length > MAX_ITEMS) {
    throw new Error(`明細は1〜${MAX_ITEMS}件で指定してください。`)
  }
  const o = isObj(v.options) ? v.options : {}
  const priceMode: PriceMode = o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  const rounding: RoundingMode = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    id: typeof v.id === 'string' && v.id !== '' ? v.id.slice(0, 64) : newId(),
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt.slice(0, 40) : new Date().toISOString(),
    issuer: sanitizeIssuer(v.issuer),
    clientName: str(v.clientName, 100),
    honorific: v.honorific === '様' ? '様' : '御中',
    number: str(v.number, 40),
    issueDate: isIsoDate(v.issueDate) ? v.issueDate : '',
    dueDate: isIsoDate(v.dueDate) ? v.dueDate : '',
    items: v.items.map(sanitizeItem),
    options: { priceMode, rounding, withholding: o.withholding === true },
    bank: str(v.bank, 300),
    notes: str(v.notes, 1000),
  }
}

export function buildBackup(issuer: Issuer, invoices: Invoice[]): Backup {
  return { app: 'invoice-maker', version: 1, issuer, invoices }
}

export function backupToBlob(backup: Backup): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseBackupText(text: string): Backup {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み取れません。')
  }
  if (!isObj(parsed) || parsed.app !== 'invoice-maker' || !Array.isArray(parsed.invoices)) {
    throw new Error('このサイトで書き出したバックアップファイルではありません。')
  }
  return {
    app: 'invoice-maker',
    version: 1,
    issuer: sanitizeIssuer(parsed.issuer),
    invoices: parsed.invoices.slice(0, 1000).map(sanitizeInvoice),
  }
}

export interface CheckResult {
  label: string
  ok: boolean
  hint?: string
}
