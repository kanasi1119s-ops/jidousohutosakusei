import { computeInvoice, type Invoice } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

// 表計算ソフトで数式として解釈されないよう、先頭が = + - @ の文字列セルは先頭にシングルクォートを付ける
function safeText(value: string): string {
  return /^[=+\-@]/.test(value) ? "'" + value : value
}

export function buildInvoiceCsv(invoice: Invoice): string {
  const result = computeInvoice(invoice)
  const header = ['請求書番号', '発行日', '請求先', '品目', '数量', '単価(円)', '税率(%)', '金額(税抜・円)']
  const rows = invoice.items.map((it, i) => [
    safeText(invoice.invoiceNo),
    invoice.issueDate,
    safeText(invoice.clientName),
    safeText(it.description),
    String(it.quantity),
    String(it.unitPriceYen),
    String(it.taxRate),
    String(result.lineAmounts[i]),
  ])
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(invoice: Invoice): Blob {
  return new Blob([buildInvoiceCsv(invoice)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字のみ（日本語ファイル名はZIP展開等で化けるため使わない） */
export function safeFileStem(invoiceNo: string, issueDate: string): string {
  const no = invoiceNo.replace(/[^A-Za-z0-9_-]/g, '').replace(/^[-_]+/, '')
  return `invoice-${no ? no + '-' : ''}${issueDate || 'undated'}`
}
