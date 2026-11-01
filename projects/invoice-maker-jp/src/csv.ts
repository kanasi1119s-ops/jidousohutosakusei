import { calcInvoice, type Invoice } from './invoice'

const UTF8_BOM = '﻿'

function esc(value: string): string {
  // CSVインジェクション対策: 先頭が = + - @ の文字列は先頭にシングルクォートを付ける
  const safe = /^[=+\-@]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const t = calcInvoice(inv.items, inv.rounding)
  const header = ['請求書番号', '発行日', '請求先', '品名', '数量', '単価(税抜)', '税率(%)', '金額(税抜)']
  const rows = inv.items.map((it, i) => [
    inv.number,
    inv.issueDate,
    inv.customerName,
    it.name,
    String(it.qty),
    String(it.unitPrice),
    String(it.rate),
    String(t.lineAmounts[i]),
  ])
  rows.push(...t.byRate.map((r) => [inv.number, inv.issueDate, inv.customerName, `${r.rate}%対象 消費税`, '', '', String(r.rate), String(r.tax)]))
  rows.push([inv.number, inv.issueDate, inv.customerName, '合計(税込)', '', '', '', String(t.total)])
  return UTF8_BOM + [header, ...rows].map((c) => c.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ファイル名は英数字・ハイフンのみ（日本語の請求書番号は除去する）。 */
export function safeFileName(base: string, ext: string, fallback = 'invoice'): string {
  const cleaned = base.replace(/[^A-Za-z0-9_-]/g, '')
  return `${cleaned || fallback}.${ext}`
}
