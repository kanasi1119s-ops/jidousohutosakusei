import type { InvoiceResult } from './calc'
import type { Invoice } from './storage'

const UTF8_BOM = '\uFEFF'

function escapeCsvField(value: string): string {
  // 数式インジェクション対策: 先頭が = + - @ の文字列は先頭にシングルクォートを付ける
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoiceCsv(inv: Invoice, result: InvoiceResult): string {
  const header = ['請求書番号', '発行日', '請求先', '品目', '数量', '単価(円)', '税率(%)', '金額(円)']
  const rows = inv.items.map((it, i) => [
    inv.number,
    inv.issueDate,
    inv.customerName,
    it.name,
    String(it.quantity),
    String(it.unitPrice),
    it.taxRate === 0 ? '非課税' : String(it.taxRate),
    String(result.lineAmounts[i]),
  ])
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice, result: InvoiceResult): Blob {
  return new Blob([buildInvoiceCsv(inv, result)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字・ハイフン・アンダースコアのみ（日本語は使わない） */
export function safeFileName(base: string, ext: string): string {
  const cleaned = base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${cleaned || 'invoice'}.${ext}`
}

export function csvDownloadFileName(number: string, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return safeFileName(`invoice-${number}-${y}-${m}-${d}`, 'csv')
}
