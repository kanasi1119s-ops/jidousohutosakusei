import type { Invoice } from './model'
import { SCHEMA, sanitizeInvoice } from './model'
import { calcInvoice } from './calc'

const UTF8_BOM = '﻿'
const KEY = 'invoice-generator:draft'

function esc(v: string): string {
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

export function buildItemsCsv(inv: Invoice): string {
  const t = calcInvoice(inv)
  const header = ['品名', '数量', '単価(円)', '税率(%)', '金額(円)']
  const rows = inv.items.map((it, i) => [it.name, String(it.quantity), String(it.unitPrice), String(it.taxRate), String(t.lineAmounts[i])])
  return UTF8_BOM + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildJson(inv: Invoice): string {
  return JSON.stringify({ schema: SCHEMA, invoice: inv }, null, 2) + '\n'
}

export function parseImportedJson(text: string): Invoice | null {
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  try {
    const o = JSON.parse(t) as { schema?: unknown; invoice?: unknown }
    if (o.schema !== SCHEMA) return null
    return sanitizeInvoice(o.invoice)
  } catch {
    return null
  }
}

export function downloadFileName(inv: Invoice, ext: 'csv' | 'json'): string {
  // ファイル名は英数字・ハイフンのみ（日本語は文字化け防止のため使わない）
  const safe = inv.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '')
  return `invoice-${safe || 'draft'}-${inv.issueDate || 'nodate'}.${ext}`
}

export function saveDraft(inv: Invoice): void {
  try { localStorage.setItem(KEY, buildJson(inv)) } catch { /* 保存不可環境では無視 */ }
}
export function loadDraft(): Invoice | null {
  try {
    const t = localStorage.getItem(KEY)
    return t ? parseImportedJson(t) : null
  } catch { return null }
}

export function triggerDownload(content: string, mime: string, fileName: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
