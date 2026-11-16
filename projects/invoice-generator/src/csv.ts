import { computeInvoice, lineAmount, type Invoice } from './calc'

const UTF8_BOM = '﻿'

export function escapeCsvField(value: string): string {
  // 先頭が = + - @ の文字列は表計算ソフトで数式として解釈されるため、先頭にアポストロフィを付けて無効化する
  const safe = /^[=+@]/.test(value) || /^-(?!\d)/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const rows: string[][] = [['区分', '品名', '数量', '単価(円)', '税率', '金額(円)']]
  for (const it of inv.items) {
    rows.push(['明細', it.name, String(it.quantity), String(it.unitPriceYen), it.taxRate + '%', String(lineAmount(it, inv.rounding))])
  }
  const t = computeInvoice(inv)
  for (const g of t.groups) {
    rows.push(['集計', `${g.rate}%対象 税抜`, '', '', g.rate + '%', String(g.netYen)])
    rows.push(['集計', `${g.rate}%対象 消費税`, '', '', g.rate + '%', String(g.taxYen)])
  }
  if (inv.withholding) rows.push(['集計', '源泉徴収税額', '', '', '', String(-t.withholdingYen)])
  rows.push(['集計', '請求金額', '', '', '', String(t.payableYen)])
  return UTF8_BOM + rows.map((r) => r.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function safeFileStem(s: string): string {
  const stem = s.replace(/[^A-Za-z0-9_-]/g, '')
  return stem || 'invoice'
}

export function csvFileName(inv: Invoice): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate) ? inv.issueDate : 'undated'
  return `invoice-${safeFileStem(inv.number)}-${date}.csv`
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
