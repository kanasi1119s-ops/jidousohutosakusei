import type { LineItem, RoundingMode, TaxRate } from './calc'

export interface InvoiceState {
  issuerName: string
  issuerAddress: string
  registrationNumber: string
  issuerContact: string
  bankInfo: string
  clientName: string
  invoiceNumber: string
  issueDate: string // YYYY-MM-DD
  dueDate: string
  note: string
  rounding: RoundingMode
  items: LineItem[]
}

export const STORAGE_KEY = 'invoice-maker-v1'

export function defaultState(today: Date = new Date()): InvoiceState {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return {
    issuerName: '',
    issuerAddress: '',
    registrationNumber: '',
    issuerContact: '',
    bankInfo: '',
    clientName: '',
    invoiceNumber: `${y}${m}${d}-001`,
    issueDate: `${y}-${m}-${d}`,
    dueDate: '',
    note: '',
    rounding: 'floor',
    items: [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
  }
}

const STRING_KEYS = [
  'issuerName',
  'issuerAddress',
  'registrationNumber',
  'issuerContact',
  'bankInfo',
  'clientName',
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'note',
] as const

function isRate(v: unknown): v is TaxRate {
  return v === 10 || v === 8 || v === 0
}

/** 外部ファイル(JSON)や保存データを検証して InvoiceState に変換する。不正なら null */
export function parseState(raw: unknown): InvoiceState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const base = defaultState()
  const out: InvoiceState = { ...base }
  for (const k of STRING_KEYS) {
    const v = o[k]
    if (v !== undefined) {
      if (typeof v !== 'string') return null
      out[k] = v.slice(0, 2000)
    }
  }
  if (o.rounding !== undefined) {
    if (o.rounding !== 'floor' && o.rounding !== 'round' && o.rounding !== 'ceil') return null
    out.rounding = o.rounding
  }
  if (o.items !== undefined) {
    if (!Array.isArray(o.items) || o.items.length > 200) return null
    const items: LineItem[] = []
    for (const it of o.items) {
      if (typeof it !== 'object' || it === null) return null
      const r = it as Record<string, unknown>
      if (
        typeof r.name !== 'string' ||
        typeof r.quantity !== 'number' ||
        typeof r.unitPriceYen !== 'number' ||
        !Number.isFinite(r.quantity) ||
        !Number.isFinite(r.unitPriceYen) ||
        !isRate(r.taxRate)
      )
        return null
      items.push({
        name: r.name.slice(0, 500),
        quantity: r.quantity,
        unitPriceYen: r.unitPriceYen,
        taxRate: r.taxRate,
      })
    }
    out.items = items.length > 0 ? items : base.items
  }
  return out
}

export function loadState(): InvoiceState | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return null
    return parseState(JSON.parse(text))
  } catch {
    return null
  }
}

export function saveState(state: InvoiceState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function stateToJsonBlob(state: InvoiceState): Blob {
  return new Blob([JSON.stringify({ app: 'invoice-maker', version: 1, ...state }, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
}
