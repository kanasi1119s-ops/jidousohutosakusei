import {
  MAX_INVOICES,
  emptyIssuer,
  sanitizeInvoice,
  sanitizeIssuer,
  type BackupData,
  type Invoice,
  type Issuer,
} from './model'

const KEY = 'invoice-maker:data:v1'
const DRAFT_KEY = 'invoice-maker:draft:v1'

export interface StoredData {
  issuer: Issuer
  invoices: Invoice[]
}

export function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { issuer: emptyIssuer(), invoices: [] }
    const o = JSON.parse(raw)
    return {
      issuer: sanitizeIssuer(o?.issuer),
      invoices: Array.isArray(o?.invoices) ? o.invoices.slice(0, MAX_INVOICES).map(sanitizeInvoice) : [],
    }
  } catch {
    return { issuer: emptyIssuer(), invoices: [] }
  }
}

/** 保存に成功したら true。容量超過・プライベートモード等では false。 */
export function saveData(data: StoredData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function loadDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? sanitizeInvoice(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function saveDraft(inv: Invoice): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(inv))
  } catch {
    // 保存不可でも編集は継続できるようにする
  }
}

export function toBackup(data: StoredData): BackupData {
  return { version: 1, issuer: data.issuer, invoices: data.invoices }
}

export function backupBlob(data: StoredData): Blob {
  return new Blob([JSON.stringify(toBackup(data), null, 2)], { type: 'application/json;charset=utf-8' })
}

/** id が同じ請求書は上書き、そうでなければ追加する。 */
export function mergeInvoices(current: Invoice[], incoming: Invoice[]): Invoice[] {
  const map = new Map(current.map((i) => [i.id, i]))
  for (const inv of incoming) map.set(inv.id, inv)
  return Array.from(map.values()).slice(0, MAX_INVOICES)
}
