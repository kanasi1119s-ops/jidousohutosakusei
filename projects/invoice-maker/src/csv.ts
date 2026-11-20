import type { Invoice } from './model'
import { computeTotals } from './calc'

const UTF8_BOM = '﻿'

function esc(value: string): string {
  // 先頭が = + - @ の文字列はExcelで数式として解釈されうるため、無害化する（CSVインジェクション対策）
  const safe = /^[=+\-@]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const t = computeTotals(inv.items, inv.rounding)
  const rows: string[][] = [['品名', '数量', '単価(円)', '税率(%)', '金額(税抜・円)']]
  inv.items.forEach((it, i) => {
    rows.push([it.description, String(it.quantity), String(it.unitPriceYen), String(it.taxRate), String(t.lineAmounts[i])])
  })
  rows.push([])
  for (const r of t.byRate) {
    rows.push([`${r.rate}%対象 小計(税抜)`, '', '', String(r.rate), String(r.subtotalYen)])
    rows.push([`${r.rate}%対象 消費税額`, '', '', String(r.rate), String(r.taxYen)])
  }
  rows.push(['合計(税込)', '', '', '', String(t.totalYen)])
  return UTF8_BOM + rows.map((c) => c.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字・ハイフン・アンダースコアのみ（日本語は使わない）。 */
export function safeFileName(base: string, ext: string, fallback = 'invoice'): string {
  const cleaned = base.replace(/[^A-Za-z0-9_-]/g, '').replace(/-{2,}/g, '-')
  return `${cleaned || fallback}.${ext}`
}

export function csvFileName(inv: Invoice): string {
  return safeFileName(`invoice-${inv.invoiceNumber}-${inv.issueDate}`, 'csv')
}
