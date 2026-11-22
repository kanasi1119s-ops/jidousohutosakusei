import { computeInvoice } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

/** CSVインジェクション対策（先頭の = + - @ をExcelが数式と解釈しないようにする）を含むエスケープ */
export function escapeCsvField(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = [
    '請求書番号',
    '発行日',
    '支払期限',
    '請求先',
    '件名',
    '税抜合計(円)',
    '消費税(円)',
    '税込合計(円)',
    '源泉徴収(円)',
    '請求額(円)',
  ]
  const rows = invoices.map((inv) => {
    const t = computeInvoice(inv.lines, inv.priceMode, inv.rounding, inv.withholding)
    return [
      inv.number,
      inv.issueDate,
      inv.dueDate,
      inv.clientName,
      inv.subject,
      String(t.subtotal),
      String(t.tax),
      String(t.total),
      String(t.withholding),
      String(t.payable),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function csvBlob(text: string): Blob {
  return new Blob([text], { type: 'text/csv;charset=utf-8' })
}

export function csvFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoices-${y}-${m}-${d}.csv`
}

export function jsonFileName(date: Date = new Date()): string {
  return csvFileName(date).replace(/^invoices-/, 'invoice-generator-backup-').replace('.csv', '.json')
}
