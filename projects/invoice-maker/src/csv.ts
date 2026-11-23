import { calcInvoice, type Invoice } from './calc'

const UTF8_BOM = '﻿'

/** CSV/数式インジェクション対策（Excelで =,+,-,@ 始まりが式扱いされるのを防ぐ）＋RFC4180のエスケープ */
export function escapeCsvField(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = ['請求書番号', '発行日', '支払期限', '宛先', '税抜合計10%', '消費税10%', '税抜合計8%', '消費税8%', '税込合計']
  const rows = invoices.map((inv) => {
    const t = calcInvoice(inv)
    const g10 = t.groups.find((g) => g.rate === 10)
    const g8 = t.groups.find((g) => g.rate === 8)
    return [
      inv.number,
      inv.issueDate,
      inv.dueDate,
      inv.customer,
      String(g10?.subtotalExcl ?? 0),
      String(g10?.tax ?? 0),
      String(g8?.subtotalExcl ?? 0),
      String(g8?.tax ?? 0),
      String(t.grandTotal),
    ]
  })
  return UTF8_BOM + [header, ...rows].map((r) => r.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function dateStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const csvFileName = (d?: Date) => `invoice-list-${dateStamp(d)}.csv`
export const backupFileName = (d?: Date) => `invoice-maker-backup-${dateStamp(d)}.json`
