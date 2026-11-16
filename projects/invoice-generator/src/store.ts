import { TAX_RATES, type Invoice, type Issuer, type Item, type PriceMode, type Rounding, type TaxRate } from './calc'

const KEY = 'invoice-generator:v1'
const MAX_TEXT = 2000
const MAX_ITEMS = 200
const MAX_INVOICES = 5000

export interface StoreData {
  version: 1
  issuer: Issuer
  draft: Invoice | null
  invoices: Invoice[]
}

export function emptyIssuer(): Issuer {
  return { name: '', registrationNumber: '', address: '', bank: '' }
}

export function emptyStore(): StoreData {
  return { version: 1, issuer: emptyIssuer(), draft: null, invoices: [] }
}

function str(v: unknown, max = MAX_TEXT): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function normalizeItem(v: unknown): Item {
  const o = (v ?? {}) as Record<string, unknown>
  const rate = TAX_RATES.includes(o.taxRate as TaxRate) ? (o.taxRate as TaxRate) : 10
  return { name: str(o.name, 200), quantity: num(o.quantity), unitPriceYen: num(o.unitPriceYen), taxRate: rate }
}

export function normalizeIssuer(v: unknown): Issuer {
  const o = (v ?? {}) as Record<string, unknown>
  return { name: str(o.name, 200), registrationNumber: str(o.registrationNumber, 20), address: str(o.address), bank: str(o.bank) }
}

export function normalizeInvoice(v: unknown): Invoice {
  const o = (v ?? {}) as Record<string, unknown>
  const items = Array.isArray(o.items) ? o.items.slice(0, MAX_ITEMS).map(normalizeItem) : []
  const priceMode: PriceMode = o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    id: str(o.id, 64) || newId(),
    number: str(o.number, 100),
    clientName: str(o.clientName, 200),
    issueDate: str(o.issueDate, 10),
    dueDate: str(o.dueDate, 10),
    subject: str(o.subject, 200),
    items,
    priceMode,
    rounding,
    withholding: o.withholding === true,
    notes: str(o.notes),
    issuer: normalizeIssuer(o.issuer),
  }
}

export function normalizeStore(v: unknown): StoreData {
  if (typeof v !== 'object' || v === null) throw new Error('JSONの形式が正しくありません。')
  const o = v as Record<string, unknown>
  if (o.version !== 1) throw new Error('対応していないデータ形式です（version が 1 ではありません）。')
  return {
    version: 1,
    issuer: normalizeIssuer(o.issuer),
    draft: o.draft ? normalizeInvoice(o.draft) : null,
    invoices: Array.isArray(o.invoices) ? o.invoices.slice(0, MAX_INVOICES).map(normalizeInvoice) : [],
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyStore()
    return normalizeStore(JSON.parse(raw))
  } catch {
    return emptyStore()
  }
}

export function saveStore(data: StoreData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function serializeStore(data: StoreData): string {
  return JSON.stringify(data, null, 2) + '\n'
}

/** インポート文字列を解析する。先頭のBOMは取り除く */
export function parseImport(text: string): StoreData {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  return normalizeStore(parsed)
}
