import { parseInvoice, type Invoice } from './model'

const KEY = 'invoice-maker:draft:v1'

export function saveDraft(inv: Invoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(inv))
  } catch {
    // ストレージ不可（プライベートモード等）でも致命的にしない
  }
}

export function loadDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return parseInvoice(JSON.parse(raw))
  } catch {
    return null
  }
}

export function invoiceToJsonBlob(inv: Invoice): Blob {
  return new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json;charset=utf-8' })
}

/** JSON テキストを取り込む。先頭に BOM があれば除去する。 */
export function parseInvoiceJsonText(text: string): Invoice {
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let data: unknown
  try {
    data = JSON.parse(t)
  } catch {
    throw new Error('ファイルを JSON として読み込めませんでした。')
  }
  return parseInvoice(data)
}
