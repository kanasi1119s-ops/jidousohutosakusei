import {
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  type Line,
  type PriceMode,
  type Rounding,
  type TaxRate,
} from './calc'

export interface Issuer {
  name: string
  address: string
  registrationNumber: string
  contact: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  recipient: string
  subject: string
  lines: Line[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
  notes: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  invoices: Invoice[]
  currentId: string
}

export const LIMITS = {
  maxInvoices: 1000,
  maxLines: 200,
  maxText: 2000,
  maxFileBytes: 5 * 1024 * 1024,
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export function todayString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function emptyLine(): Line {
  return { name: '', quantity: 1, unit: '', unitPrice: 0, taxRate: 10 }
}

export function suggestInvoiceNumber(existing: Invoice[], date: Date = new Date()): string {
  const ym = todayString(date).slice(0, 7).replace('-', '')
  const prefix = `INV-${ym}-`
  const used = new Set(existing.map((i) => i.number))
  let n = existing.filter((i) => i.number.startsWith(prefix)).length + 1
  while (used.has(prefix + String(n).padStart(3, '0'))) n++
  return prefix + String(n).padStart(3, '0')
}

export function newInvoice(existing: Invoice[], date: Date = new Date()): Invoice {
  const issue = todayString(date)
  const due = new Date(date.getFullYear(), date.getMonth() + 2, 0)
  return {
    id: newId(),
    number: suggestInvoiceNumber(existing, date),
    issueDate: issue,
    dueDate: todayString(due),
    recipient: '',
    subject: '',
    lines: [emptyLine()],
    priceMode: 'exclusive',
    rounding: 'floor',
    withholding: false,
    notes: '',
  }
}

export function emptyIssuer(): Issuer {
  return { name: '', address: '', registrationNumber: '', contact: '', bank: '' }
}

export function defaultAppData(): AppData {
  const invoice = newInvoice([])
  return { version: 1, issuer: emptyIssuer(), invoices: [invoice], currentId: invoice.id }
}

// ---- 入力検証（localStorage の読み込み・JSON インポート共通） ----

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, LIMITS.maxText) : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function dateStr(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function sanitizeLine(raw: unknown): Line {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rate = r.taxRate === 8 || r.taxRate === 0 ? (r.taxRate as TaxRate) : 10
  return {
    name: str(r.name),
    quantity: Math.max(-1e6, Math.min(1e6, num(r.quantity, 1))),
    unit: str(r.unit),
    unitPrice: Math.max(-1e8, Math.min(1e8, num(r.unitPrice))),
    taxRate: rate,
  }
}

export function sanitizeIssuer(raw: unknown): Issuer {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    name: str(r.name),
    address: str(r.address),
    registrationNumber: normalizeRegistrationNumber(str(r.registrationNumber)),
    contact: str(r.contact),
    bank: str(r.bank),
  }
}

export function sanitizeInvoice(raw: unknown): Invoice {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lines = Array.isArray(r.lines) ? r.lines.slice(0, LIMITS.maxLines).map(sanitizeLine) : []
  return {
    id: str(r.id) || newId(),
    number: str(r.number),
    issueDate: dateStr(r.issueDate),
    dueDate: dateStr(r.dueDate),
    recipient: str(r.recipient),
    subject: str(r.subject),
    lines: lines.length > 0 ? lines : [emptyLine()],
    priceMode: r.priceMode === 'inclusive' ? 'inclusive' : 'exclusive',
    rounding: r.rounding === 'round' || r.rounding === 'ceil' ? r.rounding : 'floor',
    withholding: r.withholding === true,
    notes: str(r.notes),
  }
}

/** 不正な構造は例外にする（インポート用）。 */
export function parseAppData(text: string): AppData {
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ファイルの形式が不正です（オブジェクトではありません）。')
  }
  const p = parsed as Record<string, unknown>
  if (p.version !== 1) {
    throw new Error('対応していないバージョンのファイルです。')
  }
  if (!Array.isArray(p.invoices)) {
    throw new Error('ファイルの形式が不正です（invoices が配列ではありません）。')
  }
  const invoices = p.invoices.slice(0, LIMITS.maxInvoices).map(sanitizeInvoice)
  // id の重複を解消する
  const seen = new Set<string>()
  for (const inv of invoices) {
    if (seen.has(inv.id)) inv.id = newId()
    seen.add(inv.id)
  }
  if (invoices.length === 0) invoices.push(newInvoice([]))
  const currentId =
    typeof p.currentId === 'string' && seen.has(p.currentId) ? p.currentId : invoices[0].id
  return { version: 1, issuer: sanitizeIssuer(p.issuer), invoices, currentId }
}

export function appDataToJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

// ---- 適格請求書の記載事項チェック ----

export interface CheckItem {
  label: string
  ok: boolean
  hint: string
  /** true: OK のときも補足として hint を表示する */
  info?: boolean
}

export function checkRequirements(issuer: Issuer, invoice: Invoice): CheckItem[] {
  const hasReduced = invoice.lines.some((l) => l.taxRate === 8 && l.name.trim() !== '')
  const namedLines = invoice.lines.filter((l) => l.name.trim() !== '')
  const regOk = isValidRegistrationNumber(issuer.registrationNumber)
  return [
    {
      label: '発行事業者の氏名または名称',
      ok: issuer.name.trim() !== '',
      hint: '「発行者情報」に入力してください。',
    },
    {
      label: '登録番号（T + 数字13桁）',
      ok: regOk,
      hint: regOk
        ? ''
        : '形式が正しくありません。実在・有効性は国税庁の適格請求書発行事業者公表サイトで確認してください。',
    },
    {
      label: '取引年月日（発行日）',
      ok: invoice.issueDate !== '',
      hint: '請求書情報の発行日を入力してください。',
    },
    {
      label: '取引内容（品名・サービス名）',
      ok: namedLines.length > 0,
      hint: '明細に品名を1行以上入力してください。',
    },
    {
      label: '軽減税率の対象品目である旨（8%の明細には※を表示）',
      ok: true,
      hint: hasReduced ? '8%の明細に ※ を自動表示しています。' : '',
      info: true,
    },
    {
      label: '税率ごとに区分した対価の額・適用税率',
      ok: namedLines.length > 0,
      hint: '請求書の「税率別内訳」に自動表示されます。',
      info: true,
    },
    {
      label: '税率ごとの消費税額（1請求書につき税率ごとに1回の端数処理）',
      ok: true,
      hint: '自動計算されます。',
      info: true,
    },
    {
      label: '書類の交付を受ける事業者の氏名または名称（宛名）',
      ok: invoice.recipient.trim() !== '',
      hint: '請求先を入力してください。',
    },
  ]
}
