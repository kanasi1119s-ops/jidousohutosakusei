import { calcTotals } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '\uFEFF'

/** CSV/Excel の数式インジェクション対策: 先頭が = + - @ の文字列には ' を付ける */
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

function field(value: string): string {
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export function buildInvoiceListCsv(list: Invoice[]): string {
  const header = ['請求書番号', '発行日', '支払期限', '取引先', '件名', '税抜合計(円)', '消費税(円)', '源泉徴収税(円)', '請求額(円)']
  const rows = list.map((inv) => {
    const t = calcTotals(inv.items, inv.priceMode, inv.rounding, inv.withholding)
    return [
      safeText(inv.number),
      inv.issueDate,
      inv.dueDate,
      safeText(inv.clientName),
      safeText(inv.subject),
      String(t.subtotal),
      String(t.taxTotal),
      String(t.withholding),
      String(t.payable),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(field).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceListCsvBlob(list: Invoice[]): Blob {
  return new Blob([buildInvoiceListCsv(list)], { type: 'text/csv;charset=utf-8' })
}

function two(n: number): string {
  return String(n).padStart(2, '0')
}

export function csvFileName(date: Date = new Date()): string {
  return `invoice-list-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.csv`
}

export function jsonFileName(date: Date = new Date()): string {
  return `invoice-backup-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.json`
}
