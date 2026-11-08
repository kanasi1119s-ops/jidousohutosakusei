import { calcInvoice } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

/** CSV/数式インジェクション対策: 先頭が = + - @ の文字列は先頭にシングルクォートを付ける。 */
export function escapeCsvField(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = ['請求書番号', '発行日', '支払期限', '請求先', '件名', '税抜合計(円)', '消費税(円)', '税込合計(円)']
  const rows = invoices.map((inv) => {
    const t = calcInvoice(inv.items, inv.priceMode, inv.rounding)
    return [
      inv.invoiceNumber, inv.issueDate, inv.dueDate, inv.clientName, inv.subject,
      String(t.subtotal), String(t.tax), String(t.total),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoicesCsvBlob(invoices: Invoice[]): Blob {
  return new Blob([buildInvoicesCsv(invoices)], { type: 'text/csv;charset=utf-8' })
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const todayString = (d: Date = new Date()): string => ymd(d)
export const csvFileName = (d: Date = new Date()): string => `invoices-${ymd(d)}.csv`
export const jsonFileName = (d: Date = new Date()): string => `invoice-maker-backup-${ymd(d)}.json`
