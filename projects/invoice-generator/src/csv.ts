import { calcTotals, lineAmountYen } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

export function escapeCsvField(value: string): string {
  // CSVインジェクション対策: 数式として解釈されうる先頭文字には ' を付ける
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const header = ['請求書番号', '発行日', '請求先', '品名・内容', '数量', '単価(円)', '税率(%)', '金額(税抜・円)']
  const rows = inv.items.map((it) => [
    inv.number, inv.issueDate, inv.clientName, it.description,
    String(it.quantity), String(it.unitPriceYen), String(it.taxRate), String(Math.round(lineAmountYen(it))),
  ])
  const t = calcTotals(inv.items, inv.rounding)
  const sums = t.byRate.map((r) => ['', '', '', `${r.taxRate}%対象 小計/消費税`, '', '', String(r.taxRate), `${r.subtotalYen}/${r.taxYen}`])
  const total = [['', '', '', '合計(税込)', '', '', '', String(t.totalYen)]]
  const lines = [header, ...rows, ...sums, ...total].map((c) => c.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字のみ（日本語は使わない）。 */
export function safeFileName(prefix: string, ext: string, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${prefix}-${y}-${m}-${d}.${ext}`
}
