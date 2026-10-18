import type { Totals } from './calc'
import { KIND_LABELS, safeFileToken, type InvoiceDoc } from './invoice'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  // 数式インジェクション対策: =,+,-,@ で始まる文字列の先頭にシングルクォートを付ける
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? "'" + value : value
  if (/[",\r\n]/.test(safe)) return '"' + safe.replace(/"/g, '""') + '"'
  return safe
}

export function buildItemsCsv(doc: InvoiceDoc, totals: Totals): string {
  const header = ['書類', '番号', '品名', '数量', '単価(円)', '税率(%)', '金額(円)']
  const rows = doc.items
    .map((it, i) => ({ it, amount: totals.lineAmounts[i] }))
    .filter(({ it }) => it.name.trim() !== '')
    .map(({ it, amount }) => [
      KIND_LABELS[doc.kind],
      doc.number,
      it.name,
      String(it.quantity),
      String(it.unitPriceYen),
      String(it.taxRate),
      String(amount),
    ])
  const summary = totals.byRate.map((r) => [
    '税率別集計',
    doc.number,
    `${r.rate}%対象`,
    '',
    '',
    String(r.rate),
    `税抜${r.base} / 消費税${r.tax} / 税込${r.total}`,
  ])
  const lines = [header, ...rows, ...summary].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildItemsCsvBlob(doc: InvoiceDoc, totals: Totals): Blob {
  return new Blob([buildItemsCsv(doc, totals)], { type: 'text/csv;charset=utf-8' })
}

export function csvFileName(doc: InvoiceDoc): string {
  return `invoice-${safeFileToken(doc.number, 'draft')}-${doc.issueDate || 'undated'}.csv`
}
