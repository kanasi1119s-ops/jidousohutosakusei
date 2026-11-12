import { computeTotals, type Invoice } from './calc'

const UTF8_BOM = '﻿'

/** Excelで式として解釈されうる先頭文字を無害化し、必要ならクォートする。 */
export function csvText(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  return csvField(v)
}

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = ['請求書番号', '発行日', '支払期限', '請求先', '品目', '数量', '単価(円)', '税率(%)', '金額(税抜・円)', '請求書の税込合計(円)']
  const lines: string[] = [header.map(csvField).join(',')]
  for (const inv of invoices) {
    const totals = computeTotals(inv.items, inv.rounding)
    inv.items.forEach((it, i) => {
      lines.push(
        [
          csvText(inv.number),
          inv.issueDate,
          inv.dueDate,
          csvText(inv.clientName),
          csvText(it.description),
          String(it.quantity),
          String(it.unitPriceYen),
          String(it.taxRate),
          String(totals.lineAmounts[i]),
          String(totals.totalYen),
        ].join(','),
      )
    })
  }
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoicesCsvBlob(invoices: Invoice[]): Blob {
  return new Blob([buildInvoicesCsv(invoices)], { type: 'text/csv;charset=utf-8' })
}

function dateStamp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function csvDownloadFileName(d: Date = new Date()): string {
  return `invoices-${dateStamp(d)}.csv`
}

export function jsonDownloadFileName(d: Date = new Date()): string {
  return `invoice-backup-${dateStamp(d)}.json`
}
