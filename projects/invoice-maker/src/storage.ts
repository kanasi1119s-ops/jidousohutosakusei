import type { Invoice, Item, Rounding, TaxMode } from './calc'
import { stripBom } from './csv'
import { MAX_INPUT } from './normalize'

export interface Issuer {
  name: string
  regNo: string
  address: string
  tel: string
  bank: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  invoices: Invoice[]
}

const KEY = 'invoice-maker:v1'

export const emptyIssuer = (): Issuer => ({ name: '', regNo: '', address: '', tel: '', bank: '' })
export const emptyData = (): AppData => ({ version: 1, issuer: emptyIssuer(), invoices: [] })

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** 外部入力（localStorage/インポートファイル）を検証・正規化。不正なら null。 */
export function sanitizeData(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.invoices)) return null
  const iss = (o.issuer && typeof o.issuer === 'object' ? o.issuer : {}) as Record<string, unknown>
  const invoices: Invoice[] = []
  for (const r of o.invoices.slice(0, 5000)) {
    if (!r || typeof r !== 'object') return null
    const x = r as Record<string, unknown>
    if (!Array.isArray(x.items)) return null
    const items: Item[] = []
    for (const it of x.items.slice(0, 500)) {
      const y = (it ?? {}) as Record<string, unknown>
      const qty = Number(y.qty)
      const unitPrice = Number(y.unitPrice)
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || Math.abs(qty) > MAX_INPUT || Math.abs(unitPrice) > MAX_INPUT) return null
      if (y.rate !== 10 && y.rate !== 8) return null
      items.push({ name: str(y.name, 200), qty, unitPrice, rate: y.rate })
    }
    const taxMode: TaxMode = x.taxMode === 'inclusive' ? 'inclusive' : 'exclusive'
    const rounding: Rounding = x.rounding === 'round' || x.rounding === 'ceil' ? x.rounding : 'floor'
    invoices.push({
      id: str(x.id, 64) || newId(),
      number: str(x.number, 64),
      customer: str(x.customer, 200),
      issueDate: str(x.issueDate, 10),
      dueDate: str(x.dueDate, 10),
      taxMode,
      rounding,
      items,
      note: str(x.note),
    })
  }
  return {
    version: 1,
    issuer: { name: str(iss.name, 200), regNo: str(iss.regNo, 20), address: str(iss.address, 300), tel: str(iss.tel, 50), bank: str(iss.bank) },
    invoices,
  }
}

export function parseImport(text: string): AppData | null {
  try {
    return sanitizeData(JSON.parse(stripBom(text)))
  } catch {
    return null
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function loadData(): AppData {
  try {
    const t = localStorage.getItem(KEY)
    if (t) return parseImport(t) ?? emptyData()
  } catch {
    // 保存領域が使えない環境では空データで継続
  }
  return emptyData()
}

export function saveData(d: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
    return true
  } catch {
    return false
  }
}
