import { calcTotals, type Invoice } from './calc'

const UTF8_BOM = '﻿'

/** 表計算ソフトで式として解釈される先頭文字を無効化する（CSVインジェクション対策） */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export function buildInvoiceCsv(inv: Invoice): string {
  const totals = calcTotals(inv)
  const header = ['請求書番号', '発行日', '請求先', '品名', '数量', '単価(円)', '税率(%)', '金額(円)']
  const rows = inv.items.map((it, i) => [
    inv.number,
    inv.issueDate,
    inv.clientName,
    it.description,
    String(it.quantity),
    String(it.unitPriceYen),
    String(it.taxRate),
    String(totals.lineAmountsYen[i]),
  ])
  const lines = [header, ...rows].map((cols, i) =>
    cols.map((c) => escapeCsvField(i === 0 ? c : neutralize(c))).join(','),
  )
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function csvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字のみ */
export function safeFileName(base: string, ext: string): string {
  const cleaned = base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${cleaned || 'invoice'}.${ext}`
}
