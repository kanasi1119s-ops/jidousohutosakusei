import type { InvoiceInput, InvoiceResult } from './calc'

const UTF8_BOM = '﻿'

function esc(value: string): string {
  // 数式インジェクション対策（Excelで =,+,-,@ 始まりが数式扱いされるのを防ぐ）
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoiceCsv(input: InvoiceInput, result: InvoiceResult): string {
  const rows: string[][] = [['品名', '数量', '単価(円)', '税率(%)', '金額(円)']]
  input.items.forEach((it, i) => {
    rows.push([it.name, String(it.quantity), String(it.unitPriceYen), String(it.taxRate), String(result.lineAmounts[i])])
  })
  rows.push([])
  rows.push(['税率区分', '対象額(税抜)', '消費税額', '対象額(税込)'])
  for (const s of result.summaries) {
    rows.push([`${s.rate}%`, String(s.baseYen), String(s.taxYen), String(s.grossYen)])
  }
  rows.push(['合計', String(result.subtotalYen), String(result.taxYen), String(result.totalYen)])
  return UTF8_BOM + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildCsvBlob(text: string): Blob {
  return new Blob([text], { type: 'text/csv;charset=utf-8' })
}

/** 先頭BOMを除去してから解析するための補助 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function safeFileName(base: string, ext: string, date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const clean = base.replace(/[^A-Za-z0-9_-]/g, '')
  return `${clean || 'invoice'}-${y}-${m}-${d}.${ext}`
}
