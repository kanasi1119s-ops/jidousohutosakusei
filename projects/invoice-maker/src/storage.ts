import type { Item, Rounding, TaxRate } from './calc'

export interface Issuer {
  name: string
  regNo: string
  address: string
  tel: string
  email: string
  bank: string
}

export interface Doc {
  issuer: Issuer
  clientName: string
  honorific: string
  invoiceNo: string
  issueDate: string
  dueDate: string
  notes: string
  withholding: boolean
  rounding: Rounding
  items: Item[]
}

const KEY = 'invoice-maker:v1'
const APP_ID = 'invoice-maker'

export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function defaultDoc(): Doc {
  const today = todayIso()
  return {
    issuer: { name: '', regNo: '', address: '', tel: '', email: '', bank: '' },
    clientName: '',
    honorific: '御中',
    invoiceNo: `INV-${today.replace(/-/g, '')}-001`,
    issueDate: today,
    dueDate: '',
    notes: '',
    withholding: false,
    rounding: 'floor',
    items: [{ name: '', qty: '1', unitPrice: '', rate: 10 }],
  }
}

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** 信頼できない入力（localStorage・インポートファイル）を検証して Doc に正規化する。不正なら null。 */
export function sanitizeDoc(raw: unknown): Doc | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const base = defaultDoc()
  const iss = (typeof r.issuer === 'object' && r.issuer !== null ? r.issuer : {}) as Record<string, unknown>
  if (!Array.isArray(r.items)) return null
  const items: Item[] = r.items.slice(0, 200).map((x) => {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>
    const rate = o.rate === 8 || o.rate === 0 ? (o.rate as TaxRate) : 10
    return { name: str(o.name, 200), qty: str(o.qty, 30), unitPrice: str(o.unitPrice, 30), rate }
  })
  const rounding: Rounding = r.rounding === 'round' || r.rounding === 'ceil' ? r.rounding : 'floor'
  return {
    issuer: {
      name: str(iss.name, 200),
      regNo: str(iss.regNo, 30),
      address: str(iss.address),
      tel: str(iss.tel, 40),
      email: str(iss.email, 200),
      bank: str(iss.bank),
    },
    clientName: str(r.clientName, 200),
    honorific: str(r.honorific, 10) || base.honorific,
    invoiceNo: str(r.invoiceNo, 60),
    issueDate: str(r.issueDate, 10),
    dueDate: str(r.dueDate, 10),
    notes: str(r.notes),
    withholding: r.withholding === true,
    rounding,
    items: items.length > 0 ? items : base.items,
  }
}

export function saveDoc(doc: Doc): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc))
  } catch {
    // 保存不可の環境（プライベートモード等）でも動作は継続する
  }
}

export function loadDoc(): Doc {
  try {
    const s = localStorage.getItem(KEY)
    if (s) {
      const d = sanitizeDoc(JSON.parse(s))
      if (d) return d
    }
  } catch {
    // 破損データは無視して初期値に戻す
  }
  return defaultDoc()
}

export function exportJson(doc: Doc): string {
  return JSON.stringify({ app: APP_ID, version: 1, exportedAt: new Date().toISOString(), doc }, null, 2)
}

export function importJson(text: string): Doc | null {
  try {
    const clean = text.replace(/^﻿/, '')
    const o = JSON.parse(clean)
    if (o && o.app === APP_ID) return sanitizeDoc(o.doc)
    return null
  } catch {
    return null
  }
}
