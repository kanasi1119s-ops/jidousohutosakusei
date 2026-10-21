import type { InvoiceDoc } from './calc'

const KEY = 'invoice-maker:docs:v1'

export function emptyDoc(today: string): InvoiceDoc {
  return {
    kind: 'invoice',
    number: '',
    issueDate: today,
    dueDate: '',
    issuer: { name: '', address: '', registrationNumber: '' },
    clientName: '',
    items: [{ name: '', qty: 1, unitPrice: 0, taxRate: 10 }],
    taxMode: 'exclusive',
    rounding: 'floor',
    bank: '',
    notes: '',
  }
}

export function isDoc(x: unknown): x is InvoiceDoc {
  if (!x || typeof x !== 'object') return false
  const d = x as Record<string, any>
  return (
    (d.kind === 'invoice' || d.kind === 'quote') &&
    typeof d.number === 'string' &&
    typeof d.issueDate === 'string' &&
    typeof d.dueDate === 'string' &&
    !!d.issuer &&
    typeof d.issuer.name === 'string' &&
    typeof d.issuer.address === 'string' &&
    typeof d.issuer.registrationNumber === 'string' &&
    typeof d.clientName === 'string' &&
    Array.isArray(d.items) &&
    d.items.every(
      (it: any) =>
        it && typeof it.name === 'string' && typeof it.qty === 'number' && typeof it.unitPrice === 'number' && (it.taxRate === 10 || it.taxRate === 8),
    ) &&
    (d.taxMode === 'exclusive' || d.taxMode === 'inclusive') &&
    (d.rounding === 'floor' || d.rounding === 'round' || d.rounding === 'ceil') &&
    typeof d.bank === 'string' &&
    typeof d.notes === 'string'
  )
}

export function saveDoc(doc: InvoiceDoc): void {
  try {
    // 入力途中のNaN/Infinityは JSON では null になり復元不能になるため 0 に置換して保存する
    localStorage.setItem(KEY, JSON.stringify(doc, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 0 : v)))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadDoc(): InvoiceDoc | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isDoc(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function docToJsonBlob(doc: InvoiceDoc): Blob {
  return new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseDocFromJsonText(text: string): InvoiceDoc {
  const parsed = JSON.parse(text.replace(/^﻿/, ''))
  if (!isDoc(parsed)) throw new Error('インポートしたファイルの形式が不正です。')
  return parsed
}

export function docFileName(doc: InvoiceDoc, ext: string): string {
  const base = (doc.number || doc.issueDate || 'draft').normalize('NFKC').replace(/[^A-Za-z0-9_-]/g, '')
  return `${doc.kind}-${base || 'draft'}.${ext}`
}
