import { MAX_ABS_AMOUNT, MAX_QUANTITY, MAX_UNIT_PRICE, lineAmount, toHalfWidth } from './calc'
import type { LineItem, PriceMode, Rounding } from './calc'

export type DocKind = 'invoice' | 'quote' | 'delivery' | 'receipt'

export const KIND_LABELS: Record<DocKind, string> = {
  invoice: '請求書',
  quote: '見積書',
  delivery: '納品書',
  receipt: '領収書',
}

export interface Issuer {
  name: string
  address: string
  contact: string
  registrationNumber: string
}

export interface InvoiceDoc {
  id: string
  kind: DocKind
  number: string
  issueDate: string
  /** 取引年月日（「2026年10月分」「2026-10-01〜2026-10-31」のような期間表記も可） */
  transactionDate: string
  dueDate: string
  clientName: string
  honorific: string
  subject: string
  items: LineItem[]
  priceMode: PriceMode
  rounding: Rounding
  bankInfo: string
  notes: string
  updatedAt: string
}

export function emptyIssuer(): Issuer {
  return { name: '', address: '', contact: '', registrationNumber: '' }
}

export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function emptyDoc(date: Date = new Date()): InvoiceDoc {
  return {
    id: newId(),
    kind: 'invoice',
    number: '',
    issueDate: todayIso(date),
    transactionDate: '',
    dueDate: '',
    clientName: '',
    honorific: '御中',
    subject: '',
    items: [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
    priceMode: 'exclusive',
    rounding: 'floor',
    bankInfo: '',
    notes: '',
    updatedAt: '',
  }
}

/** 登録番号の表記ゆれ（全角、ハイフン、空白）を正規化する。 */
export function normalizeRegistrationNumber(text: string): string {
  return toHalfWidth(text).replace(/[\s-]/g, '').toUpperCase()
}

export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}

/** 末尾の連番をインクリメントする（INV-2026-0009 → INV-2026-0010）。 */
export function nextNumber(current: string): string {
  const trimmed = current.trim()
  if (trimmed === '') return 'INV-0001'
  const m = /^(.*?)(\d+)$/.exec(trimmed)
  if (!m) return trimmed + '-1'
  const next = String(Number(m[2]) + 1).padStart(m[2].length, '0')
  return m[1] + next
}

export function isValidIsoDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** 2026-10-18 → 2026年10月18日（ロケール非依存） */
export function formatDateJa(iso: string): string {
  if (!isValidIsoDate(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export interface Validation {
  errors: string[]
  warnings: string[]
}

export function validateDocument(doc: InvoiceDoc, issuer: Issuer): Validation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isValidIsoDate(doc.issueDate)) errors.push('発行日を正しい日付で入力してください。')
  if (doc.dueDate !== '' && !isValidIsoDate(doc.dueDate)) errors.push('支払期限を正しい日付で入力してください。')
  if (doc.clientName.trim() === '') errors.push('宛名（取引先名）を入力してください。')
  if (issuer.name.trim() === '') errors.push('発行者の氏名または名称を入力してください。')

  const filled = doc.items.filter((it) => it.name.trim() !== '')
  if (filled.length === 0) errors.push('明細を1行以上入力してください（品名が空の行は無視されます）。')

  doc.items.forEach((it, i) => {
    const row = i + 1
    if (it.name.trim() === '') return
    if (!Number.isFinite(it.quantity) || it.quantity <= 0 || it.quantity > MAX_QUANTITY) {
      errors.push(`明細${row}: 数量は0より大きく${MAX_QUANTITY.toLocaleString('en-US')}以下で入力してください。`)
    } else if (Math.abs(it.quantity * 100 - Math.round(it.quantity * 100)) > 1e-6) {
      errors.push(`明細${row}: 数量は小数第2位までで入力してください。`)
    }
    if (!Number.isInteger(it.unitPriceYen) || Math.abs(it.unitPriceYen) > MAX_UNIT_PRICE) {
      errors.push(`明細${row}: 単価は円単位の整数（絶対値${MAX_UNIT_PRICE.toLocaleString('en-US')}以下）で入力してください。`)
    } else if (Number.isFinite(it.quantity) && Math.abs(lineAmount(it, doc.rounding)) > MAX_ABS_AMOUNT) {
      errors.push(`明細${row}: 金額が大きすぎます。`)
    }
  })

  if (issuer.registrationNumber.trim() !== '' && !isValidRegistrationNumber(issuer.registrationNumber)) {
    errors.push('登録番号は「T」+数字13桁の形式で入力してください（例: T1234567890123）。')
  }
  if (doc.kind === 'invoice' && issuer.registrationNumber.trim() === '') {
    warnings.push('登録番号が未入力です。適格請求書として発行するには、インボイス発行事業者の登録番号の記載が必要です。')
  }
  if (doc.kind === 'invoice' && doc.transactionDate.trim() === '') {
    warnings.push('取引年月日が未入力です。適格請求書には課税資産の譲渡等を行った年月日の記載が必要です（期間でも可）。')
  }
  if (issuer.address.trim() === '' && doc.kind === 'invoice') {
    warnings.push('発行者の住所が未入力です。')
  }
  return { errors, warnings }
}

/** ダウンロード用ファイル名に使えるよう、英数字・ハイフン・アンダースコア以外を除去する。 */
export function safeFileToken(text: string, fallback: string): string {
  const t = text.replace(/[^A-Za-z0-9_-]/g, '')
  return t === '' ? fallback : t.slice(0, 40)
}
