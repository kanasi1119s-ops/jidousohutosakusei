import type { Invoice } from './invoice'
import { calculate } from './invoice'

const UTF8_BOM = '﻿'

/** 表計算ソフトでの数式実行を防ぐため、文字列フィールドの先頭の = + - @ にアポストロフィを付ける */
export function sanitizeCsvText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = [
    '請求書番号', '発行日', '支払期限', '宛名', '登録番号',
    '10%対象(税抜)', '10%消費税', '8%対象(税抜)', '8%消費税',
    '税抜合計', '消費税合計', '税込合計',
  ]
  const rows = invoices.map((inv) => {
    const c = calculate(inv.items, inv.priceMode, inv.rounding)
    const r10 = c.byRate.find((r) => r.rate === 10)
    const r8 = c.byRate.find((r) => r.rate === 8)
    return [
      sanitizeCsvText(inv.number), inv.issueDate, inv.dueDate, sanitizeCsvText(inv.customerName), inv.issuer.registrationNumber,
      String(r10?.base ?? 0), String(r10?.tax ?? 0), String(r8?.base ?? 0), String(r8?.tax ?? 0),
      String(c.base), String(c.tax), String(c.gross),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoicesCsvBlob(invoices: Invoice[]): Blob {
  return new Blob([buildInvoicesCsv(invoices)], { type: 'text/csv;charset=utf-8' })
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function csvDownloadFileName(date: Date = new Date()): string {
  return `invoices-${ymd(date)}.csv`
}

export function jsonDownloadFileName(date: Date = new Date()): string {
  return `invoice-backup-${ymd(date)}.json`
}
