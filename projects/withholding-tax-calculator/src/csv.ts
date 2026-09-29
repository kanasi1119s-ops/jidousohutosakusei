import { CATEGORY_LABELS } from './rules'
import type { EntryResult, Totals } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  // CSVインジェクション対策: 数式として解釈される先頭文字を無効化する
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildCsv(results: EntryResult[], totals: Totals): string {
  const header = ['項目名', '区分', '報酬額(税抜)', '消費税率(%)', '消費税額', '請求額(税込)', '消費税の区分記載', '源泉徴収対象額', '源泉徴収税額', '支払額']
  const rows = results.map((r) => [
    r.entry.label,
    CATEGORY_LABELS[r.entry.category],
    String(r.entry.amountYen),
    String(r.entry.taxRatePercent),
    String(r.consumptionTaxYen),
    String(r.billedYen),
    r.entry.taxSeparated ? 'あり' : 'なし',
    String(r.subjectYen),
    String(r.withholdingYen),
    String(r.paymentYen),
  ])
  rows.push(['合計', '', '', '', '', String(totals.billedYen), '', '', String(totals.withholdingYen), String(totals.paymentYen)])
  return UTF8_BOM + [header, ...rows].map((cols) => cols.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function buildCsvBlob(results: EntryResult[], totals: Totals): Blob {
  return new Blob([buildCsv(results, totals)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `withholding-tax-${y}-${m}-${d}.csv`
}
