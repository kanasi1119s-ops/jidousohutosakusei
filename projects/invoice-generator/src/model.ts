import type { InvoiceItem, Rounding } from './calc'
import { isValidRegistrationNumber, normalizeRegistrationNumber } from './calc'

export interface Issuer {
  name: string
  registrationNumber: string
  address: string
  contact: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  subject: string
  items: InvoiceItem[]
  rounding: Rounding
  note: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  invoices: Invoice[]
}

export function emptyIssuer(): Issuer {
  return { name: '', registrationNumber: '', address: '', contact: '', bank: '' }
}

export function emptyInvoice(today: string): Invoice {
  return {
    id: 'inv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    number: '',
    issueDate: today,
    dueDate: '',
    clientName: '',
    subject: '',
    items: [{ description: '', quantity: 1, unitPriceYen: 0, taxRate: 10 }],
    rounding: 'floor',
    note: '',
  }
}

export const MAX_LINE_YEN = 99_999_999_999

export interface Problem {
  field: string
  message: string
}

/** 適格請求書として必要な項目の不足を洗い出す（発行前チェック）。 */
export function checkInvoice(issuer: Issuer, inv: Invoice): Problem[] {
  const p: Problem[] = []
  if (!issuer.name.trim()) p.push({ field: 'issuer.name', message: '発行者の氏名または名称を入力してください。' })
  if (!issuer.registrationNumber.trim()) {
    p.push({ field: 'issuer.reg', message: '適格請求書発行事業者の登録番号（T+13桁）を入力してください。免税事業者は適格請求書を発行できません。' })
  } else if (!isValidRegistrationNumber(issuer.registrationNumber)) {
    p.push({ field: 'issuer.reg', message: '登録番号は「T」+数字13桁の形式で入力してください。' })
  }
  if (!inv.clientName.trim()) p.push({ field: 'client', message: '請求先の氏名または名称を入力してください。' })
  if (!inv.issueDate) p.push({ field: 'issueDate', message: '発行日を入力してください。' })
  if (inv.issueDate && inv.dueDate && inv.dueDate < inv.issueDate) p.push({ field: 'dueDate', message: '支払期限が発行日より前になっています。' })
  if (inv.items.length === 0) p.push({ field: 'items', message: '明細を1行以上入力してください。' })
  inv.items.forEach((it, i) => {
    if (!it.description.trim()) p.push({ field: `item.${i}`, message: `明細${i + 1}: 品名・内容を入力してください。` })
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) p.push({ field: `item.${i}`, message: `明細${i + 1}: 数量は0より大きい数値にしてください。` })
    if (!Number.isFinite(it.unitPriceYen)) p.push({ field: `item.${i}`, message: `明細${i + 1}: 単価が数値ではありません。` })
    else if (Math.abs(it.quantity * it.unitPriceYen) > MAX_LINE_YEN) p.push({ field: `item.${i}`, message: `明細${i + 1}: 金額が大きすぎます（上限 ${MAX_LINE_YEN.toLocaleString('ja-JP')} 円）。` })
  })
  return p
}

function isStr(v: unknown): v is string {
  return typeof v === 'string'
}

export function parseAppData(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new Error('JSONとして読み込めませんでした。ファイルが壊れている可能性があります。')
  }
  const o = raw as Partial<AppData>
  if (!o || typeof o !== 'object' || o.version !== 1 || !o.issuer || !Array.isArray(o.invoices)) {
    throw new Error('このアプリのバックアップファイルではありません（version または必須項目がありません）。')
  }
  const i = o.issuer
  for (const k of ['name', 'registrationNumber', 'address', 'contact', 'bank'] as const) {
    if (!isStr(i[k])) throw new Error(`発行者情報の形式が不正です（${k}）。`)
  }
  const invoices: Invoice[] = o.invoices.map((v, idx) => {
    const x = v as Invoice
    const ok =
      x && isStr(x.id) && isStr(x.number) && isStr(x.issueDate) && isStr(x.dueDate) && isStr(x.clientName) &&
      isStr(x.subject) && isStr(x.note) && ['floor', 'round', 'ceil'].includes(x.rounding) && Array.isArray(x.items)
    if (!ok) throw new Error(`請求書${idx + 1}件目の形式が不正です。`)
    for (const it of x.items) {
      if (!isStr(it.description) || !Number.isFinite(it.quantity) || !Number.isFinite(it.unitPriceYen) || ![10, 8, 0].includes(it.taxRate)) {
        throw new Error(`請求書${idx + 1}件目の明細の形式が不正です。`)
      }
    }
    return x
  })
  return {
    version: 1,
    issuer: { ...i, registrationNumber: normalizeRegistrationNumber(i.registrationNumber) },
    invoices,
  }
}
