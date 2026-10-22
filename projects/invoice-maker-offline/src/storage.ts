import type { LineInput, RoundingMode, TaxRate } from './calc'
import { MAX_LINES } from './calc'
import { UTF8_BOM } from './csv'
import type { AppData, DocType, InvoiceDoc, IssuerInfo } from './types'
import { emptyIssuer } from './types'

export const STORAGE_KEY = 'invoice-maker-offline:data:v1'
export const MAX_DOCS = 500
const MAX_TEXT = 2000

function str(v: unknown, max = MAX_TEXT): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const DOC_TYPES: DocType[] = ['invoice', 'quote', 'delivery', 'receipt']
const ROUNDINGS: RoundingMode[] = ['floor', 'round', 'ceil']

function sanitizeItem(v: unknown): LineInput | null {
  if (!isObj(v)) return null
  const rate = Number(v.taxRate)
  const taxRate: TaxRate = rate === 8 ? 8 : rate === 0 ? 0 : 10
  return {
    description: str(v.description, 200),
    quantity: str(v.quantity, 30),
    unitPrice: str(v.unitPrice, 30),
    taxRate,
  }
}

export function sanitizeDoc(v: unknown): InvoiceDoc | null {
  if (!isObj(v)) return null
  const id = str(v.id, 64).replace(/[^A-Za-z0-9_-]/g, '')
  if (id === '') return null
  const rawItems = Array.isArray(v.items) ? v.items.slice(0, MAX_LINES) : []
  const items = rawItems.map(sanitizeItem).filter((x): x is LineInput => x !== null)
  return {
    id,
    docType: DOC_TYPES.includes(v.docType as DocType) ? (v.docType as DocType) : 'invoice',
    number: str(v.number, 50),
    issueDate: str(v.issueDate, 10),
    dueDate: str(v.dueDate, 10),
    clientName: str(v.clientName, 200),
    items: items.length > 0 ? items : [{ description: '', quantity: '1', unitPrice: '', taxRate: 10 }],
    rounding: ROUNDINGS.includes(v.rounding as RoundingMode) ? (v.rounding as RoundingMode) : 'floor',
    withholding: v.withholding === true,
    notes: str(v.notes),
    updatedAt: str(v.updatedAt, 40),
  }
}

export function sanitizeIssuer(v: unknown): IssuerInfo {
  if (!isObj(v)) return emptyIssuer()
  return {
    name: str(v.name, 200),
    address: str(v.address),
    contact: str(v.contact, 200),
    registrationNumber: str(v.registrationNumber, 40),
    bankInfo: str(v.bankInfo),
  }
}

/** 取り込んだJSON（信頼できない入力）を検証して AppData にする。不正なら null */
export function sanitizeAppData(v: unknown): AppData | null {
  if (!isObj(v) || v.version !== 1) return null
  const rawDocs = Array.isArray(v.docs) ? v.docs.slice(0, MAX_DOCS) : []
  const docs = rawDocs.map(sanitizeDoc).filter((d): d is InvoiceDoc => d !== null)
  return {
    version: 1,
    issuer: sanitizeIssuer(v.issuer),
    docs,
    draft: v.draft ? sanitizeDoc(v.draft) : null,
  }
}

export function parseImportedJson(text: string): AppData | null {
  const body = text.startsWith(UTF8_BOM) ? text.slice(1) : text
  try {
    return sanitizeAppData(JSON.parse(body))
  } catch {
    return null
  }
}

export function serializeAppData(data: AppData): string {
  return JSON.stringify(data, null, 2) + '\n'
}

export function loadAppData(storage: Pick<Storage, 'getItem'> | null): AppData {
  const fallback: AppData = { version: 1, issuer: emptyIssuer(), docs: [], draft: null }
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return fallback
    return sanitizeAppData(JSON.parse(raw)) ?? fallback
  } catch {
    return fallback
  }
}

export function saveAppData(storage: Pick<Storage, 'setItem'> | null, data: AppData): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data))
    return storage !== null
  } catch {
    return false
  }
}

export function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
