import { computeTotals, lineAmountYen } from './calc'
import type { Invoice } from './types'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  // 先頭が = + - @ の場合、表計算ソフトで数式として解釈されるのを防ぐ
  const safe = /^[=+@]/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(invoice: Invoice): string {
  const header = ['請求書番号', '請求日', '請求先', '品名', '数量', '単価(円)', '税率(%)', '金額(税抜・円)']
  const rows = invoice.items.map((it) => [
    invoice.number,
    invoice.issueDate,
    invoice.clientName,
    it.name,
    String(it.quantity),
    String(it.unitPriceYen),
    String(it.taxRate),
    String(lineAmountYen(it)),
  ])
  const t = computeTotals(invoice.items, invoice.rounding, invoice.withholding)
  const summary: string[][] = [
    ...t.byRate.map((r) => ['', '', '', `${r.rate}%対象 小計(税抜)`, '', '', String(r.rate), String(r.subtotalYen)]),
    ...t.byRate.map((r) => ['', '', '', `${r.rate}%対象 消費税額`, '', '', String(r.rate), String(r.taxYen)]),
    ['', '', '', '源泉徴収税額', '', '', '', String(t.withholdingYen)],
    ['', '', '', '請求金額', '', '', '', String(t.totalYen)],
  ]
  return UTF8_BOM + [header, ...rows, ...summary].map((c) => c.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(invoice: Invoice): Blob {
  return new Blob([buildInvoiceCsv(invoice)], { type: 'text/csv;charset=utf-8' })
}

/** 英数字のみのファイル名にする（日本語ファイル名はZIP展開などで化けるため使わない）。 */
export function safeFileName(invoiceNumber: string, ext: string): string {
  const base = invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '') || 'invoice'
  return `invoice-${base}.${ext}`
}
