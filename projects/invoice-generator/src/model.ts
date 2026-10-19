import { MAX_LINE_AMOUNT, type LineItem, type PriceMode, type RoundingMode } from './calc'

export interface Party {
  name: string
  address: string
  contact: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  issuer: Party & { registrationNumber: string; bank: string }
  clientName: string
  honorific: '御中' | '様'
  subject: string
  items: LineItem[]
  priceMode: PriceMode
  rounding: RoundingMode
  withholding: boolean
  notes: string
}

export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function newId(): string {
  return `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyInvoice(issuer?: Invoice['issuer']): Invoice {
  const today = todayIso()
  return {
    id: newId(),
    number: '',
    issueDate: today,
    dueDate: '',
    issuer: issuer ?? { name: '', address: '', contact: '', registrationNumber: '', bank: '' },
    clientName: '',
    honorific: '御中',
    subject: '',
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
    priceMode: 'exclusive',
    rounding: 'floor',
    withholding: false,
    notes: '',
  }
}

const RATES = [10, 8, 0]
const MODES_ROUND = ['floor', 'round', 'ceil']
const MODES_PRICE = ['exclusive', 'inclusive']

const isStr = (v: unknown): v is string => typeof v === 'string'

/** 外部入力（localStorage / インポートJSON）を検証して Invoice へ。不正なら Error。 */
export function validateInvoice(raw: unknown): Invoice {
  if (typeof raw !== 'object' || raw === null) throw new Error('請求書データの形式が不正です。')
  const o = raw as Record<string, unknown>
  const issuer = (o.issuer ?? {}) as Record<string, unknown>
  if (!Array.isArray(o.items)) throw new Error('請求書データの形式が不正です（items が配列ではありません）。')
  const items: LineItem[] = o.items.map((it) => {
    const r = (it ?? {}) as Record<string, unknown>
    if (
      !isStr(r.name) ||
      typeof r.quantity !== 'number' ||
      !Number.isFinite(r.quantity) ||
      typeof r.unitPrice !== 'number' ||
      !Number.isFinite(r.unitPrice) ||
      !RATES.includes(r.taxRate as number) ||
      Math.abs(r.quantity * r.unitPrice) > MAX_LINE_AMOUNT
    ) {
      throw new Error('請求書データの形式が不正です（明細の値が不正）。')
    }
    return { name: r.name, quantity: r.quantity, unitPrice: Math.round(r.unitPrice), taxRate: r.taxRate as LineItem['taxRate'] }
  })
  if (items.length > 200) throw new Error('明細が多すぎます（最大200行）。')
  if (!MODES_ROUND.includes(o.rounding as string) || !MODES_PRICE.includes(o.priceMode as string)) {
    throw new Error('請求書データの形式が不正です（端数処理または価格区分）。')
  }
  const s = (v: unknown): string => (isStr(v) ? v : '')
  return {
    id: isStr(o.id) && o.id ? o.id : newId(),
    number: s(o.number),
    issueDate: s(o.issueDate),
    dueDate: s(o.dueDate),
    issuer: {
      name: s(issuer.name),
      address: s(issuer.address),
      contact: s(issuer.contact),
      registrationNumber: s(issuer.registrationNumber),
      bank: s(issuer.bank),
    },
    clientName: s(o.clientName),
    honorific: o.honorific === '様' ? '様' : '御中',
    subject: s(o.subject),
    items,
    priceMode: o.priceMode as Invoice['priceMode'],
    rounding: o.rounding as Invoice['rounding'],
    withholding: o.withholding === true,
    notes: s(o.notes),
  }
}
