import { computeInvoice } from './calc'
import type { Rounding } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

/** CSVインジェクション対策: 先頭が = + - @ タブ CR の場合は ' を前置する（数値の負数は除く） */
export function neutralizeFormula(value: string): string {
  if (/^[=+@\t\r]/.test(value)) return "'" + value
  if (/^-/.test(value) && !/^-\d+(\.\d+)?$/.test(value)) return "'" + value
  return value
}

export function escapeCsvField(value: string): string {
  const v = neutralizeFormula(value)
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

export function buildInvoicesCsv(invoices: Invoice[], rounding: Rounding): string {
  const header = [
    '請求書番号',
    '発行日',
    '支払期限',
    '宛名',
    '件名',
    '税抜合計(円)',
    '消費税(円)',
    '源泉徴収(円)',
    '請求金額(円)',
  ]
  const rows = invoices.map((inv) => {
    const t = computeInvoice(inv.items, rounding, inv.withholding)
    return [
      inv.number,
      inv.issueDate,
      inv.dueDate,
      `${inv.clientName}${inv.honorific}`,
      inv.subject,
      String(t.subtotal),
      String(t.tax),
      String(t.withholding),
      String(t.total),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoicesCsvBlob(invoices: Invoice[], rounding: Rounding): Blob {
  return new Blob([buildInvoicesCsv(invoices, rounding)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoice-list-${y}-${m}-${d}.csv`
}

export function backupFileName(date: Date = new Date()): string {
  return csvDownloadFileName(date).replace('invoice-list-', 'invoice-maker-backup-').replace('.csv', '.json')
}
