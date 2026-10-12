import { EMPTY_ISSUER, sanitizeInvoice, sanitizeIssuer, type Invoice, type Issuer } from './model'

const KEY_INVOICES = 'invoice-maker:v1:invoices'
const KEY_ISSUER = 'invoice-maker:v1:issuer'
const KEY_DRAFT = 'invoice-maker:v1:draft'

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** 保存に成功したら true。容量超過・プライベートモード等では false。 */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadInvoices(): Invoice[] {
  const raw = read(KEY_INVOICES)
  if (!Array.isArray(raw)) return []
  const out: Invoice[] = []
  for (const v of raw) {
    try {
      out.push(sanitizeInvoice(v))
    } catch {
      // 壊れた1件で全体を失わないよう、読み取れない項目だけ読み飛ばす
    }
  }
  return out
}

export function saveInvoices(invoices: Invoice[]): boolean {
  return write(KEY_INVOICES, invoices)
}

export function loadIssuer(): Issuer {
  const raw = read(KEY_ISSUER)
  return raw ? sanitizeIssuer(raw) : { ...EMPTY_ISSUER }
}

export function saveIssuer(issuer: Issuer): boolean {
  return write(KEY_ISSUER, issuer)
}

export function loadDraft(): Invoice | null {
  const raw = read(KEY_DRAFT)
  if (!raw) return null
  try {
    return sanitizeInvoice(raw)
  } catch {
    return null
  }
}

export function saveDraft(invoice: Invoice): boolean {
  return write(KEY_DRAFT, invoice)
}
