import type { CalcResult } from './calc'
import type { Invoice } from './model'
import { sanitizeFileNamePart } from './util'

const UTF8_BOM = '﻿'

/** Excel での式実行（CSVインジェクション）を防ぐため、先頭が式記号のセルにはアポストロフィを付ける。 */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

const RATE_LABEL: Record<number, string> = { 10: '10', 8: '8', 0: '非課税' }

export function buildInvoiceCsv(invoice: Invoice, result: CalcResult): string {
  const priceLabel = invoice.options.priceMode === 'inclusive' ? '単価(税込・円)' : '単価(税抜・円)'
  const rows: string[][] = [
    ['品名', '数量', priceLabel, '税率(%)', '金額(円)'],
    ...invoice.items.map((it, i) => [
      neutralize(it.name),
      String(it.quantity),
      String(it.unitPriceYen),
      RATE_LABEL[it.taxRate],
      String(result.lineAmounts[i]),
    ]),
    [],
    ['税率区分', '対象額(税抜・円)', '消費税額(円)', '合計(税込・円)'],
    ...result.groups.map((g) => [
      g.taxRate === 0 ? '非課税' : `${g.taxRate}%対象`,
      String(g.subtotalYen),
      String(g.taxYen),
      String(g.totalYen),
    ]),
    ['合計', String(result.subtotalYen), String(result.taxYen), String(result.totalYen)],
  ]
  if (invoice.options.withholding) {
    rows.push(['源泉徴収税額', '', '', String(-result.withholdingYen)])
    rows.push(['差引請求額', '', '', String(result.payableYen)])
  }
  const lines = rows.map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(invoice: Invoice, result: CalcResult): Blob {
  return new Blob([buildInvoiceCsv(invoice, result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(invoice: Invoice): string {
  return `invoice-${sanitizeFileNamePart(invoice.number)}.csv`
}

export function jsonDownloadFileName(date: string): string {
  return `invoice-maker-backup-${sanitizeFileNamePart(date, 'data')}.json`
}
