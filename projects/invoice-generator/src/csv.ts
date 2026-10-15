import type { Invoice } from './invoice'
import { calcTotals } from './calc'

const UTF8_BOM = '﻿'

function esc(v: string): string {
  // CSVインジェクション対策: 式として解釈され得る先頭文字を無効化する
  const safe = /^[=+@\t\r-]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? "'" + v : v
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const t = calcTotals(inv.items, inv.rounding)
  const header = ['請求書番号', '発行日', '宛名', '品名', '数量', '単価(円)', '税率(%)', '金額(円・税抜)']
  const rows = inv.items.map((it, i) => [
    inv.invoiceNo,
    inv.issueDate,
    inv.clientName,
    it.name,
    String(it.quantity),
    String(it.unitPrice),
    String(it.taxRate),
    String(t.lineAmounts[i]),
  ])
  rows.push(['', '', '', '合計(税込)', '', '', '', String(t.total)])
  return UTF8_BOM + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function csvBlob(text: string): Blob {
  return new Blob([text], { type: 'text/csv;charset=utf-8' })
}

/** ファイル名は英数字のみ（日本語ファイル名はZIP展開等で化けるため使わない）。 */
export function downloadName(prefix: string, ext: string, date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.${ext}`
}
