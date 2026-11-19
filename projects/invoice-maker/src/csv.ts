import { calculate, type Rounding } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

/** Excel での数式実行（CSVインジェクション）を防ぐため、文字列セルの先頭の記号にアポストロフィを付ける。 */
function textCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v
  return escape(safe)
}
function escape(v: string): string {
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

const roundingLabel: Record<Rounding, string> = { floor: '切り捨て', round: '四捨五入', ceil: '切り上げ' }

export function buildInvoiceCsv(inv: Invoice): string {
  const t = calculate(inv.items, inv.priceMode, inv.rounding)
  const incl = inv.priceMode === 'inclusive'
  const rows: string[] = []
  rows.push(['品名', '数量', '単位', '単価(円)', '税率(%)', incl ? '金額(税込・円)' : '金額(税抜・円)'].join(','))
  inv.items.forEach((it, i) => {
    rows.push(
      [textCell(it.name), String(it.quantity), textCell(it.unit), String(it.unitPrice), String(it.taxRate), String(t.lineAmounts[i])].join(','),
    )
  })
  rows.push('')
  rows.push(['税率(%)', incl ? '税込合計(円)' : '税抜合計(円)', incl ? '内消費税額(円)' : '消費税額(円)'].join(','))
  for (const g of t.groups) rows.push([String(g.rate), String(g.amount), String(g.tax)].join(','))
  rows.push(['合計請求額(円)', String(t.grandTotal), ''].join(','))
  rows.push(['端数処理', roundingLabel[inv.rounding], ''].join(','))
  return UTF8_BOM + rows.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}
