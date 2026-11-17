import type { Item, RoundingMode } from './calc'

export interface Invoice {
  id: string
  invoiceNo: string
  issueDate: string // YYYY-MM-DD
  dueDate: string
  sellerName: string
  sellerRegNo: string // T + 13桁
  sellerAddress: string
  buyerName: string
  items: Item[]
  rounding: RoundingMode
  withholding: boolean
  note: string
}

export function newInvoice(today: Date = new Date()): Invoice {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return {
    id: 'inv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    invoiceNo: `${y}${m}${d}-001`,
    issueDate: `${y}-${m}-${d}`,
    dueDate: '',
    sellerName: '',
    sellerRegNo: '',
    sellerAddress: '',
    buyerName: '',
    items: [{ name: '', qty: 1, unitPrice: 0, taxRate: 10 }],
    rounding: 'floor',
    withholding: false,
    note: '',
  }
}

/** 登録番号: 半角T + 数字13桁。全角は半角へ正規化して判定する。 */
export function normalizeRegNo(raw: string): string {
  return raw
    .replace(/[Ｔｔ]/g, 'T')
    .replace(/t/g, 'T')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[-－\s]/g, '')
}

export function isValidRegNo(raw: string): boolean {
  return /^T\d{13}$/.test(normalizeRegNo(raw))
}

export function validateInvoice(inv: Invoice): string[] {
  const errs: string[] = []
  if (!inv.sellerName.trim()) errs.push('発行者の氏名又は名称を入力してください')
  if (!inv.sellerRegNo.trim()) errs.push('登録番号（T+13桁）を入力してください（適格請求書の必須項目）')
  else if (!isValidRegNo(inv.sellerRegNo)) errs.push('登録番号は「T」+数字13桁の形式で入力してください')
  if (!inv.buyerName.trim()) errs.push('宛先（書類の交付を受ける事業者の氏名又は名称）を入力してください')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate)) errs.push('取引年月日（発行日）を入力してください')
  if (inv.items.length === 0) errs.push('明細を1行以上入力してください')
  inv.items.forEach((it, i) => {
    if (!it.name.trim()) errs.push(`明細${i + 1}: 品名を入力してください`)
    if (!Number.isFinite(it.qty) || it.qty < 0) errs.push(`明細${i + 1}: 数量は0以上の数値で入力してください`)
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) errs.push(`明細${i + 1}: 単価は0以上の数値で入力してください`)
  })
  return errs
}

/** JSONインポート用の形式検証。不正なら null。 */
export function sanitizeInvoice(x: unknown): Invoice | null {
  if (typeof x !== 'object' || x === null) return null
  const o = x as Record<string, unknown>
  const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '')
  if (!Array.isArray(o.items) || o.items.length > 200) return null
  const items: Item[] = []
  for (const it of o.items) {
    if (typeof it !== 'object' || it === null) return null
    const r = it as Record<string, unknown>
    const qty = Number(r.qty)
    const unitPrice = Number(r.unitPrice)
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) return null
    items.push({ name: str(r.name, 200), qty, unitPrice, taxRate: r.taxRate === 8 ? 8 : 10 })
  }
  const rounding = o.rounding === 'ceil' || o.rounding === 'round' ? o.rounding : 'floor'
  return {
    id: str(o.id, 60) || newInvoice().id,
    invoiceNo: str(o.invoiceNo, 60),
    issueDate: str(o.issueDate, 10),
    dueDate: str(o.dueDate, 10),
    sellerName: str(o.sellerName, 200),
    sellerRegNo: str(o.sellerRegNo, 30),
    sellerAddress: str(o.sellerAddress, 300),
    buyerName: str(o.buyerName, 200),
    items,
    rounding,
    withholding: o.withholding === true,
    note: str(o.note, 2000),
  }
}
