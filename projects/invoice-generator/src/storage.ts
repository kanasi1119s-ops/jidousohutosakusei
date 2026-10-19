import { validateInvoice, type Invoice } from './model'

const KEY = 'invoice-generator:invoices:v1'

export function loadInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const out: Invoice[] = []
    for (const a of arr) {
      try {
        out.push(validateInvoice(a))
      } catch {
        // 壊れた1件があっても他の請求書は読み込む
      }
    }
    return out
  } catch {
    return []
  }
}

/** 保存に成功したら true（容量超過・プライベートモード等では false） */
export function saveInvoices(list: Invoice[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function upsertInvoice(list: Invoice[], inv: Invoice): Invoice[] {
  const i = list.findIndex((x) => x.id === inv.id)
  if (i < 0) return [...list, inv]
  const copy = list.slice()
  copy[i] = inv
  return copy
}

export function exportJsonBlob(list: Invoice[]): Blob {
  const body = { app: 'invoice-generator', version: 1, invoices: list }
  return new Blob([JSON.stringify(body, null, 2)], { type: 'application/json;charset=utf-8' })
}

/** エクスポートJSON（先頭BOMがあっても許容）を解析する */
export function parseImport(text: string): Invoice[] {
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(t)
  } catch {
    throw new Error('JSONとして読み込めませんでした。')
  }
  const o = parsed as { invoices?: unknown }
  const arr = Array.isArray(parsed) ? parsed : o?.invoices
  if (!Array.isArray(arr)) throw new Error('請求書データが見つかりませんでした。')
  return arr.map(validateInvoice)
}

/** 取り込んだ請求書を既存一覧へマージ（同じIDは上書き） */
export function mergeInvoices(base: Invoice[], incoming: Invoice[]): Invoice[] {
  return incoming.reduce((acc, inv) => upsertInvoice(acc, inv), base)
}
