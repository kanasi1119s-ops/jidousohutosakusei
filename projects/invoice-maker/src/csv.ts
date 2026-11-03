import { calcTotals, lineAmount, type Invoice } from './calc'

const UTF8_BOM = '﻿'

function esc(v: string): string {
  // CSVインジェクション対策: 式として解釈され得る先頭文字を無効化
  const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const t = calcTotals(inv.items, inv.rounding)
  const header = ['品目', '数量', '単価(円)', '税率(%)', '金額(税抜,円)']
  const rows = inv.items
    .filter((i) => i.name.trim())
    .map((i) => [i.name, String(i.quantity), String(i.unitPrice), String(i.taxRate), String(lineAmount(i))])
  const foot = t.byRate.map((r) => [`${r.rate}%対象 小計/消費税`, '', '', String(r.rate), `${r.subtotal}/${r.tax}`])
  foot.push(['合計(税込)', '', '', '', String(t.total)])
  const lines = [header, ...rows, ...foot].map((c) => c.map(esc).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロード名は英数字のみ（日本語ファイル名はZIP展開等で化けるため使わない） */
export function safeFileName(inv: Invoice, ext: string): string {
  const no = inv.invoiceNo.replace(/[^A-Za-z0-9_-]/g, '') || 'draft'
  const date = inv.issueDate || 'nodate'
  return `invoice-${no}-${date}.${ext}`
}
