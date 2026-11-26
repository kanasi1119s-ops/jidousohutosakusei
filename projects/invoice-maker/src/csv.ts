import { calcTotals, lineAmountYen } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

export function escapeCsvField(value: string): string {
  // CSVインジェクション対策: 式として解釈され得る先頭文字には ' を付ける
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const header = ['品目', '数量', '単価(税抜・円)', '税率(%)', '金額(税抜・円)']
  const rows = inv.items.map((i) => [i.name, String(i.quantity), String(i.unitPriceYen), String(i.taxRate), String(lineAmountYen(i))])
  const t = calcTotals(inv.items, inv.rounding)
  const sum = t.breakdowns.map((b) => [`${b.taxRate}%対象 合計(税抜)`, '', '', String(b.taxRate), String(b.subtotalYen)])
  const tax = t.breakdowns.map((b) => [`${b.taxRate}%の消費税額`, '', '', String(b.taxRate), String(b.taxYen)])
  const total = [['請求金額(税込)', '', '', '', String(t.totalYen)]]
  const lines = [header, ...rows, ...sum, ...tax, ...total].map((c) => c.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}
