import type { LineItem, PriceMode, Rounding, TaxRate } from './calc'
import { emptyIssuer, isValidIsoDate, newId, type DocKind, type InvoiceDoc, type Issuer } from './invoice'

const ISSUER_KEY = 'invoice-maker-jp:issuer:v1'
const DOCS_KEY = 'invoice-maker-jp:docs:v1'
const DRAFT_KEY = 'invoice-maker-jp:draft:v1'
const MAX_TEXT = 2000
const MAX_DOCS = 500
const MAX_ITEMS = 200

export const BACKUP_APP = 'invoice-maker-jp'
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  issuer: Issuer
  documents: InvoiceDoc[]
}

function str(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function sanitizeIssuer(raw: unknown): Issuer {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = emptyIssuer()
  return {
    name: str(o.name, 200) || base.name,
    address: str(o.address),
    contact: str(o.contact),
    registrationNumber: str(o.registrationNumber, 40),
  }
}

export function sanitizeDoc(raw: unknown): InvoiceDoc {
  if (!raw || typeof raw !== 'object') throw new Error('書類データの形式が不正です。')
  const o = raw as Record<string, unknown>
  const itemsRaw = Array.isArray(o.items) ? o.items.slice(0, MAX_ITEMS) : []
  const items: LineItem[] = itemsRaw.map((r) => {
    const it = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
    const quantity = typeof it.quantity === 'number' && Number.isFinite(it.quantity) ? it.quantity : 1
    const unit = typeof it.unitPriceYen === 'number' && Number.isFinite(it.unitPriceYen) ? it.unitPriceYen : 0
    return {
      name: str(it.name, 200),
      quantity,
      unitPriceYen: unit,
      taxRate: (it.taxRate === 8 ? 8 : 10) as TaxRate,
    }
  })
  const issueDate = str(o.issueDate, 10)
  const dueDate = str(o.dueDate, 10)
  return {
    id: str(o.id, 40) || newId(),
    kind: oneOf<DocKind>(o.kind, ['invoice', 'quote', 'delivery', 'receipt'], 'invoice'),
    number: str(o.number, 60),
    issueDate: isValidIsoDate(issueDate) ? issueDate : '',
    transactionDate: str(o.transactionDate, 60),
    dueDate: isValidIsoDate(dueDate) ? dueDate : '',
    clientName: str(o.clientName, 200),
    honorific: oneOf(o.honorific, ['御中', '様', ''], '御中'),
    subject: str(o.subject, 200),
    items: items.length > 0 ? items : [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
    priceMode: oneOf<PriceMode>(o.priceMode, ['exclusive', 'inclusive'], 'exclusive'),
    rounding: oneOf<Rounding>(o.rounding, ['floor', 'round', 'ceil'], 'floor'),
    bankInfo: str(o.bankInfo),
    notes: str(o.notes),
    updatedAt: str(o.updatedAt, 40),
  }
}

export function buildBackup(issuer: Issuer, documents: InvoiceDoc[]): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, issuer, documents }
}

export function backupToBlob(backup: Backup): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function backupFileName(date: string): string {
  return `invoice-maker-backup-${date}.json`
}

/** JSON文字列を検証して取り込む。先頭のBOMは除去する。形式が不正なら例外。 */
export function parseBackup(text: string): Backup {
  const body = text.replace(/^\uFEFF/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('JSONとして読み込めませんでした。バックアップファイルを選択してください。')
  }
  const o = parsed as Record<string, unknown> | null
  if (!o || typeof o !== 'object' || o.app !== BACKUP_APP || !Array.isArray(o.documents)) {
    throw new Error('このアプリのバックアップファイルではありません。')
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    issuer: sanitizeIssuer(o.issuer),
    documents: o.documents.slice(0, MAX_DOCS).map(sanitizeDoc),
  }
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // ストレージ使用不可（プライベートモード・容量超過）でも致命的にしない
    return false
  }
}

export function loadIssuer(): Issuer {
  return sanitizeIssuer(readJson(ISSUER_KEY))
}

export function saveIssuer(issuer: Issuer): boolean {
  return writeJson(ISSUER_KEY, issuer)
}

export function loadDocuments(): InvoiceDoc[] {
  const raw = readJson(DOCS_KEY)
  if (!Array.isArray(raw)) return []
  const docs: InvoiceDoc[] = []
  for (const r of raw.slice(0, MAX_DOCS)) {
    try {
      docs.push(sanitizeDoc(r))
    } catch {
      // 壊れた1件で全体を失わない
    }
  }
  return docs
}

export function saveDocuments(docs: InvoiceDoc[]): boolean {
  return writeJson(DOCS_KEY, docs)
}

export function loadDraft(): InvoiceDoc | null {
  const raw = readJson(DRAFT_KEY)
  if (!raw) return null
  try {
    return sanitizeDoc(raw)
  } catch {
    return null
  }
}

export function saveDraft(doc: InvoiceDoc): boolean {
  return writeJson(DRAFT_KEY, doc)
}
