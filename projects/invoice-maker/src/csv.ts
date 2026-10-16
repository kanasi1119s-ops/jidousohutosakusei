import { calcInvoice, lineAmount } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

/** CSVインジェクション対策: 先頭が = + - @ タブ CR の文字列は先頭に ' を付けて無害化する。 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = [
    '請求書番号',
    '発行日',
    '支払期限',
    '請求先',
    '件名',
    '品名',
    '数量',
    '単価(円)',
    '税率(%)',
    '明細金額(円)',
    '価格の入力方式',
    '請求額合計(円)',
  ]
  const rows: string[][] = []
  for (const inv of invoices) {
    const totals = calcInvoice(inv)
    inv.lines.forEach((l) => {
      rows.push([
        neutralizeFormula(inv.number),
        inv.issueDate,
        inv.dueDate,
        neutralizeFormula(inv.clientName),
        neutralizeFormula(inv.subject),
        neutralizeFormula(l.description),
        String(l.quantity),
        String(l.unitPrice),
        String(l.taxRate),
        String(lineAmount(l, inv.rounding)),
        inv.priceMode === 'inclusive' ? '税込' : '税抜',
        String(totals.payable),
      ])
    })
  }
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoicesCsvBlob(invoices: Invoice[]): Blob {
  return new Blob([buildInvoicesCsv(invoices)], { type: 'text/csv;charset=utf-8' })
}

export function dateStamp(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function csvFileName(date?: Date): string {
  return `invoices-${dateStamp(date)}.csv`
}

export function backupFileName(date?: Date): string {
  return `invoice-maker-backup-${dateStamp(date)}.json`
}

/** 請求書番号をファイル名・ドキュメントタイトルに使える英数字のみへ変換する。 */
export function safeFileStem(s: string): string {
  const t = s.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return t === '' ? 'invoice' : t.slice(0, 60)
}
