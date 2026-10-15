import type { LineItem, RoundingMode } from './calc'
import { isValidRegistrationNumber } from './calc'

export interface Invoice {
  id: string
  invoiceNo: string
  issueDate: string
  dueDate: string
  issuerName: string
  issuerRegNo: string
  issuerAddress: string
  issuerContact: string
  clientName: string
  items: LineItem[]
  rounding: RoundingMode
  bankInfo: string
  notes: string
}

export function emptyInvoice(today: string): Invoice {
  return {
    id: 'inv-' + Date.now().toString(36),
    invoiceNo: '',
    issueDate: today,
    dueDate: '',
    issuerName: '',
    issuerRegNo: '',
    issuerAddress: '',
    issuerContact: '',
    clientName: '',
    items: [{ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
    rounding: 'floor',
    bankInfo: '',
    notes: '',
  }
}

/** 適格請求書の記載事項（登録番号・日付・税率ごとの対価と税額 等）の不足を返す。 */
export function validateInvoice(inv: Invoice): string[] {
  const errors: string[] = []
  if (!inv.issuerName.trim()) errors.push('発行者の氏名または名称を入力してください')
  if (!inv.issuerRegNo.trim()) {
    errors.push('登録番号（T+13桁）が未入力です。適格請求書として発行するには必要です')
  } else if (!isValidRegistrationNumber(inv.issuerRegNo.trim())) {
    errors.push('登録番号は「T」+数字13桁の形式で入力してください')
  }
  if (!inv.clientName.trim()) errors.push('宛名（取引先）を入力してください')
  if (!inv.issueDate) errors.push('発行日を入力してください')
  if (inv.items.length === 0) errors.push('明細を1行以上入力してください')
  inv.items.forEach((it, i) => {
    if (!it.name.trim()) errors.push(`明細${i + 1}: 品名を入力してください`)
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) errors.push(`明細${i + 1}: 数量は0より大きい数値にしてください`)
    if (!Number.isFinite(it.unitPrice)) errors.push(`明細${i + 1}: 単価は数値で入力してください`)
  })
  return errors
}

function isLineItem(x: unknown): x is LineItem {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    typeof o.name === 'string' &&
    typeof o.quantity === 'number' &&
    Number.isFinite(o.quantity) &&
    typeof o.unitPrice === 'number' &&
    Number.isFinite(o.unitPrice) &&
    (o.taxRate === 10 || o.taxRate === 8)
  )
}

/** インポートしたJSONを検証して Invoice に変換する。不正なら Error。 */
export function parseInvoiceJson(text: string): Invoice[] {
  const cleaned = text.replace(/^﻿/, '')
  let data: unknown
  try {
    data = JSON.parse(cleaned)
  } catch {
    throw new Error('JSONとして読み込めませんでした')
  }
  const list = Array.isArray(data) ? data : [data]
  return list.map((raw, idx) => {
    if (typeof raw !== 'object' || raw === null) throw new Error(`${idx + 1}件目の形式が不正です`)
    const o = raw as Record<string, unknown>
    const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
    if (!Array.isArray(o.items) || !o.items.every(isLineItem)) {
      throw new Error(`${idx + 1}件目の明細の形式が不正です`)
    }
    const rounding: RoundingMode = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
    return {
      id: str('id') || 'inv-' + Date.now().toString(36) + idx,
      invoiceNo: str('invoiceNo'),
      issueDate: str('issueDate'),
      dueDate: str('dueDate'),
      issuerName: str('issuerName'),
      issuerRegNo: str('issuerRegNo'),
      issuerAddress: str('issuerAddress'),
      issuerContact: str('issuerContact'),
      clientName: str('clientName'),
      items: o.items as LineItem[],
      rounding,
      bankInfo: str('bankInfo'),
      notes: str('notes'),
    }
  })
}
