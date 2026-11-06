import { calcTotals } from './calc'
import type { InvoiceState } from './state'

const UTF8_BOM = '﻿'

function esc(value: string): string {
  // CSVインジェクション対策: 式として解釈され得る先頭文字の前にシングルクォートを付ける
  const safe = /^[=+@\t\r]/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildItemsCsv(state: InvoiceState): string {
  const totals = calcTotals(state.items, state.rounding)
  const header = ['品名', '数量', '単価(税抜・円)', '税率(%)', '金額(税抜・円)']
  const rows = state.items.map((it, i) => [
    it.name,
    String(it.quantity),
    String(it.unitPriceYen),
    String(it.taxRate),
    String(totals.lineAmounts[i]),
  ])
  const lines = [header, ...rows].map((cols) => cols.map(esc).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildItemsCsvBlob(state: InvoiceState): Blob {
  return new Blob([buildItemsCsv(state)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字・ハイフン・アンダースコアのみ */
export function safeFileStem(invoiceNumber: string): string {
  const s = invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '')
  return s === '' ? 'invoice' : `invoice-${s}`
}
