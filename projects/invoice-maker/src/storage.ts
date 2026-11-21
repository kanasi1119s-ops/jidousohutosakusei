import type { InvoiceInput, IssuerInfo, LineItem } from './calc'
import { stripBom } from './csv'

const KEY = 'invoice-maker:state:v1'
export const FORMAT = 'invoice-maker'

export interface SavedInvoice {
  id: string
  savedAt: string
  invoice: InvoiceInput
}

export interface AppState {
  issuer: IssuerInfo
  invoice: InvoiceInput
  saved: SavedInvoice[]
}

export function todayString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function emptyItem(): LineItem {
  return { name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }
}

export function defaultState(): AppState {
  return {
    issuer: { name: '', postalAddress: '', registrationNumber: '', contact: '', bankInfo: '' },
    invoice: {
      invoiceNumber: '',
      issueDate: todayString(),
      dueDate: '',
      customerName: '',
      priceMode: 'excl',
      rounding: 'floor',
      items: [emptyItem()],
      note: '',
    },
    saved: [],
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

function sanitizeInvoice(v: any): InvoiceInput {
  const base = defaultState().invoice
  if (!v || typeof v !== 'object') return base
  const items: LineItem[] = Array.isArray(v.items)
    ? v.items.slice(0, 200).map((it: any) => ({
        name: str(it?.name),
        quantity: num(it?.quantity, 1),
        unitPriceYen: num(it?.unitPriceYen, 0),
        taxRate: it?.taxRate === 8 ? 8 : 10,
      }))
    : base.items
  return {
    invoiceNumber: str(v.invoiceNumber),
    issueDate: str(v.issueDate) || base.issueDate,
    dueDate: str(v.dueDate),
    customerName: str(v.customerName),
    priceMode: v.priceMode === 'incl' ? 'incl' : 'excl',
    rounding: v.rounding === 'round' || v.rounding === 'ceil' ? v.rounding : 'floor',
    items: items.length ? items : base.items,
    note: str(v.note),
  }
}

function sanitizeIssuer(v: any): IssuerInfo {
  return {
    name: str(v?.name),
    postalAddress: str(v?.postalAddress),
    registrationNumber: str(v?.registrationNumber),
    contact: str(v?.contact),
    bankInfo: str(v?.bankInfo),
  }
}

export function sanitizeState(v: any): AppState {
  const saved: SavedInvoice[] = Array.isArray(v?.saved)
    ? v.saved.slice(0, 500).map((s: any, i: number) => ({
        id: str(s?.id) || `imported-${i}`,
        savedAt: str(s?.savedAt),
        invoice: sanitizeInvoice(s?.invoice),
      }))
    : []
  return { issuer: sanitizeIssuer(v?.issuer), invoice: sanitizeInvoice(v?.invoice), saved }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ストレージが使えない環境でも致命的にしない
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return sanitizeState(JSON.parse(raw))
  } catch {
    // 破損データは無視して初期状態から始める
  }
  return defaultState()
}

export function stateToJson(state: AppState): string {
  return JSON.stringify({ format: FORMAT, version: 1, ...state }, null, 2)
}

export function stateToJsonBlob(state: AppState): Blob {
  return new Blob([stateToJson(state)], { type: 'application/json;charset=utf-8' })
}

export function parseStateFromJsonText(text: string): AppState {
  let parsed: any
  try {
    parsed = JSON.parse(stripBom(text))
  } catch {
    throw new Error('インポートしたファイルはJSONとして読み取れませんでした。')
  }
  if (!parsed || parsed.format !== FORMAT) {
    throw new Error('インポートしたファイルの形式が不正です（このサイトで書き出したJSONではありません）。')
  }
  return sanitizeState(parsed)
}
