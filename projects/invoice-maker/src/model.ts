export type TaxRate = 10 | 8 | 0
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface Line {
  description: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface Issuer {
  name: string
  registrationNumber: string
  address: string
  tel: string
  email: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  subject: string
  lines: Line[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
  notes: string
}

export interface BackupData {
  version: 1
  issuer: Issuer
  invoices: Invoice[]
}

export const MAX_LINES = 100
export const MAX_INVOICES = 500
export const MAX_AMOUNT = 99_999_999_999
const MAX_TEXT = 2000

export function emptyIssuer(): Issuer {
  return { name: '', registrationNumber: '', address: '', tel: '', email: '', bank: '' }
}

export function emptyLine(): Line {
  return { description: '', quantity: 1, unitPrice: 0, taxRate: 10 }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyInvoice(now: Date = new Date()): Invoice {
  const due = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  const ym = formatDate(now).slice(0, 7).replace('-', '')
  return {
    id: newId(),
    number: `INV-${ym}-001`,
    issueDate: formatDate(now),
    dueDate: formatDate(due),
    clientName: '',
    subject: '',
    lines: [emptyLine()],
    priceMode: 'exclusive',
    rounding: 'floor',
    withholding: false,
    notes: '',
  }
}

/** 全角英数字・記号を半角に変換する（登録番号や数値入力の揺れ対策）。 */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
}

export function parseNumber(s: string): number {
  const t = toHalfWidth(s).replace(/[,\s]/g, '')
  if (t === '') return NaN
  return Number(t)
}

export function normalizeRegistrationNumber(s: string): string {
  return toHalfWidth(s).replace(/[\s-]/g, '').toUpperCase()
}

export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(s))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function str(v: unknown, max = MAX_TEXT): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_AMOUNT ? v : fallback
}

/** 信頼できない入力（インポートファイル・保存データ）を安全な型に整形する。 */
export function sanitizeIssuer(v: unknown): Issuer {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    name: str(o.name, 200),
    registrationNumber: str(o.registrationNumber, 30),
    address: str(o.address),
    tel: str(o.tel, 50),
    email: str(o.email, 200),
    bank: str(o.bank),
  }
}

export function sanitizeLine(v: unknown): Line {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const rate = o.taxRate === 8 || o.taxRate === 0 ? o.taxRate : 10
  return {
    description: str(o.description, 300),
    quantity: num(o.quantity, 0),
    unitPrice: num(o.unitPrice, 0),
    taxRate: rate,
  }
}

export function sanitizeInvoice(v: unknown): Invoice {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const base = emptyInvoice()
  const lines = Array.isArray(o.lines) ? o.lines.slice(0, MAX_LINES).map(sanitizeLine) : []
  return {
    id: str(o.id, 40) || base.id,
    number: str(o.number, 60),
    issueDate: isValidDate(str(o.issueDate, 10)) ? str(o.issueDate, 10) : base.issueDate,
    dueDate: str(o.dueDate, 10) === '' || isValidDate(str(o.dueDate, 10)) ? str(o.dueDate, 10) : '',
    clientName: str(o.clientName, 200),
    subject: str(o.subject, 200),
    lines: lines.length > 0 ? lines : [emptyLine()],
    priceMode: o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor',
    withholding: o.withholding === true,
    notes: str(o.notes),
  }
}

export function parseBackupText(text: string): BackupData {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('ファイルの形式が不正です（JSONとして読み込めません）。')
  }
  const o = parsed as Record<string, unknown> | null
  if (!o || typeof o !== 'object' || o.version !== 1 || !Array.isArray(o.invoices)) {
    throw new Error('このアプリのバックアップファイルではありません（version または invoices が不正です）。')
  }
  return {
    version: 1,
    issuer: sanitizeIssuer(o.issuer),
    invoices: o.invoices.slice(0, MAX_INVOICES).map(sanitizeInvoice),
  }
}

/** 末尾の連番を+1する（例: INV-202610-001 → INV-202610-002）。連番がなければ -2 を付ける。 */
export function nextNumber(n: string): string {
  const m = /^(.*?)(\d+)$/.exec(n)
  if (!m) return n ? `${n}-2` : ''
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0')
}
