import { type Invoice, parseInvoice } from './model'

const STORAGE_KEY = 'invoice-maker:draft:v1'

export function saveDraft(inv: Invoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inv))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseInvoice(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function invoiceToJsonBlob(inv: Invoice): Blob {
  return new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInvoiceFromJsonText(text: string): Invoice {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み取れません。')
  }
  return parseInvoice(parsed)
}

export function downloadName(prefix: string, ext: string, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}-${y}-${m}-${d}.${ext}`
}
