import { emptyInvoice, sanitizeInvoice, type Invoice, type SavedInvoice } from './model'

const CUR = 'invoice-maker:current:v1'
const SAVED = 'invoice-maker:saved:v1'

export function saveCurrent(inv: Invoice): void {
  try {
    localStorage.setItem(CUR, JSON.stringify(inv))
  } catch {
    // ストレージ不可（プライベートモード等）でも致命的にしない
  }
}

export function loadCurrent(): Invoice {
  try {
    const raw = localStorage.getItem(CUR)
    if (raw) return sanitizeInvoice(JSON.parse(raw))
  } catch {
    // 破損データは無視して初期状態に戻す
  }
  return emptyInvoice()
}

export function loadSaved(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(SAVED)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map((s: SavedInvoice, i: number) => ({
      id: String(s.id ?? `s-${i}`),
      savedAt: String(s.savedAt ?? ''),
      invoice: sanitizeInvoice(s.invoice),
    }))
  } catch {
    return []
  }
}

export function writeSaved(list: SavedInvoice[]): void {
  try {
    localStorage.setItem(SAVED, JSON.stringify(list))
  } catch {
    // 同上
  }
}

export function jsonBlob(data: unknown): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}
