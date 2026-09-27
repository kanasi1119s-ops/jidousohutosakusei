import type { Invoice } from './invoice'
import { computeInvoiceTotals } from './invoice'

const BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildInvoiceHistoryCsv(invoices: Invoice[]): string {
  const header = ['請求書番号', '発行日', '取引先', '小計（税抜）', '消費税額', '合計（税込）']
  const rows = invoices.map((invoice) => {
    const totals = computeInvoiceTotals(invoice.items)
    return [
      invoice.number,
      invoice.issueDate,
      invoice.clientName,
      String(totals.grandSubtotalYen),
      String(totals.grandTaxYen),
      String(totals.grandTotalYen),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceHistoryCsvBlob(invoices: Invoice[]): Blob {
  return new Blob([buildInvoiceHistoryCsv(invoices)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `invoice-history-${y}${m}${d}.csv`
}
