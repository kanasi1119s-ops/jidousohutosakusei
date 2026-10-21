import { calculate, type InvoiceDoc } from './calc'

const UTF8_BOM = '﻿'

function esc(v: string): string {
  // CSVインジェクション対策: 数式として解釈され得る先頭文字を無効化
  const safe = /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? "'" + v : v
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildCsv(doc: InvoiceDoc): string {
  const t = calculate(doc)
  const header = ['品名', '数量', '単価(円)', '税率(%)', '金額(円)']
  const rows = doc.items.map((it, i) => [it.name, String(it.qty), String(it.unitPrice), String(it.taxRate), String(t.lineAmounts[i])])
  const lines = [header, ...rows].map((c) => c.map(esc).join(','))
  lines.push(['', '', '', '小計', String(t.subtotal)].join(','))
  for (const r of t.byRate) lines.push(['', '', '', `消費税(${r.rate}%)`, String(r.tax)].join(','))
  lines.push(['', '', '', '合計', String(t.total)].join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildCsvBlob(doc: InvoiceDoc): Blob {
  return new Blob([buildCsv(doc)], { type: 'text/csv;charset=utf-8' })
}
