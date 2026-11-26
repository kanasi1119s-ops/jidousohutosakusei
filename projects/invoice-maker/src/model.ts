import type { InvoiceItem, RoundingMode, TaxRate } from './calc'

export interface Invoice {
  issuerName: string
  issuerAddress: string
  registrationNumber: string // 空欄可（未登録事業者）
  recipientName: string
  invoiceNumber: string
  issueDate: string // YYYY-MM-DD（取引年月日）
  dueDate: string
  bankInfo: string
  notes: string
  rounding: RoundingMode
  items: InvoiceItem[]
}

export const emptyInvoice = (): Invoice => ({
  issuerName: '',
  issuerAddress: '',
  registrationNumber: '',
  recipientName: '',
  invoiceNumber: '',
  issueDate: '',
  dueDate: '',
  bankInfo: '',
  notes: '',
  rounding: 'floor',
  items: [{ name: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
})

const STR_KEYS = [
  'issuerName',
  'issuerAddress',
  'registrationNumber',
  'recipientName',
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'bankInfo',
  'notes',
] as const

/** 外部入力（localStorage / インポートファイル）を検証して Invoice にする。不正なら Error。 */
export function parseInvoice(raw: unknown): Invoice {
  if (typeof raw !== 'object' || raw === null) throw new Error('形式が不正です（オブジェクトではありません）。')
  const o = raw as Record<string, unknown>
  const inv = emptyInvoice()
  for (const k of STR_KEYS) {
    const v = o[k]
    if (v === undefined) continue
    if (typeof v !== 'string') throw new Error(`形式が不正です（${k} が文字列ではありません）。`)
    inv[k] = v
  }
  if (o.rounding !== undefined) {
    if (o.rounding !== 'floor' && o.rounding !== 'round' && o.rounding !== 'ceil') {
      throw new Error('形式が不正です（rounding の値が不正です）。')
    }
    inv.rounding = o.rounding
  }
  if (!Array.isArray(o.items) || o.items.length === 0) throw new Error('形式が不正です（items がありません）。')
  if (o.items.length > 500) throw new Error('明細が多すぎます（上限500行）。')
  inv.items = o.items.map((it, idx) => {
    const r = it as Record<string, unknown>
    const q = r?.quantity
    const p = r?.unitPriceYen
    const t = r?.taxRate
    if (typeof r?.name !== 'string' || typeof q !== 'number' || typeof p !== 'number' || !Number.isFinite(q) || !Number.isFinite(p)) {
      throw new Error(`形式が不正です（明細${idx + 1}）。`)
    }
    if (t !== 10 && t !== 8) throw new Error(`形式が不正です（明細${idx + 1}の税率）。`)
    return { name: r.name, quantity: q, unitPriceYen: p, taxRate: t as TaxRate }
  })
  return inv
}
