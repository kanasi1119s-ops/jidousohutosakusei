import { calcInvoice } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

function esc(v: string): string {
  // 数式インジェクション対策（先頭が = + - @ の文字列は先頭にアポストロフィを付与）
  const safe = /^[=+\-@]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? "'" + v : v
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const t = calcInvoice(inv.items, inv.rounding, inv.withholding)
  const header = ['請求書番号', '発行日', '宛先', '品名', '数量', '単価(税抜・円)', '税率(%)', '金額(税抜・円)']
  const rows = inv.items.map((it, i) => [
    inv.invoiceNo,
    inv.issueDate,
    inv.buyerName,
    it.name,
    String(it.qty),
    String(it.unitPrice),
    String(it.taxRate),
    String(t.lineAmounts[i]),
  ])
  rows.push(['', '', '', '税抜合計', '', '', '', String(t.subtotal)])
  for (const r of t.byRate) rows.push(['', '', '', `消費税(${r.rate}%対象 ${r.subtotal}円)`, '', '', String(r.rate), String(r.tax)])
  if (inv.withholding) rows.push(['', '', '', '源泉徴収税額(目安)', '', '', '', String(-t.withholding)])
  rows.push(['', '', '', '請求金額', '', '', '', String(t.total)])
  return UTF8_BOM + [header, ...rows].map((c) => c.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

export function safeFileName(prefix: string, invoiceNo: string, ext: string): string {
  const core = invoiceNo.replace(/[^A-Za-z0-9_-]/g, '') || 'draft'
  return `${prefix}-${core}.${ext}`
}
