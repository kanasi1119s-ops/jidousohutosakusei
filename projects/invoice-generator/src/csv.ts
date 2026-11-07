import { calcTotals, lineAmount } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

// 表計算ソフトで式として解釈されうる先頭文字を無害化する(CSVインジェクション対策)
function escapeCsvField(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoiceCsv(inv: Invoice): string {
  const header = ['品名', '数量', '単価(税抜)', '税率(%)', '金額(税抜)']
  const rows = inv.items.map((i) => [
    i.name,
    String(i.quantity),
    String(i.unitPrice),
    String(i.taxRate),
    String(lineAmount(i)),
  ])
  const t = calcTotals(inv.items, inv.rounding)
  const foot = [
    ...t.byRate.map((r) => [`${r.rate}%対象 小計/消費税`, '', '', String(r.rate), `${r.subtotal}/${r.tax}`]),
    ['合計(税込)', '', '', '', String(t.total)],
  ]
  const lines = [header, ...rows, ...foot].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function csvFileName(inv: Invoice): string {
  const safe = inv.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '') || 'invoice'
  return `invoice-${safe}-${inv.issueDate || 'undated'}.csv`
}

export function jsonFileName(inv: Invoice): string {
  const safe = inv.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '') || 'invoice'
  return `invoice-${safe}.json`
}
