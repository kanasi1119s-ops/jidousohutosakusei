import { calcTotals, parseNumber } from './calc'
import type { Doc } from './storage'

const UTF8_BOM = '﻿'

function esc(v: string): string {
  // 先頭が = + - @ の文字列は表計算ソフトで数式として解釈されうるため、アポストロフィで無害化する
  // （数値として出力する列は対象外）
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v
}

export function buildItemsCsv(doc: Doc): string {
  const t = calcTotals(doc.items, doc.rounding, doc.withholding)
  const header = ['品名', '数量', '単価(円)', '税率(%)', '金額(円)']
  const rows = doc.items.map((it, i) => [
    safeText(it.name),
    String(parseNumber(it.qty) ?? ''),
    String(parseNumber(it.unitPrice) ?? ''),
    String(it.rate),
    String(t.lines[i]),
  ])
  const summary: string[][] = [
    [],
    ...t.byRate.map((r) => [`税率${r.rate}%対象(税抜)`, '', '', String(r.rate), String(r.subtotal)]),
    ...t.byRate.map((r) => [`税率${r.rate}%消費税`, '', '', String(r.rate), String(r.tax)]),
    ['合計(税込)', '', '', '', String(t.total)],
  ]
  if (doc.withholding) summary.push(['源泉徴収税額', '', '', '', String(t.withholding)], ['差引請求額', '', '', '', String(t.payable)])
  const lines = [header, ...rows, ...summary].map((cols) => cols.map(esc).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function itemsCsvBlob(doc: Doc): Blob {
  return new Blob([buildItemsCsv(doc)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字・ハイフンのみ */
export function safeFileName(invoiceNo: string, ext: string, today: string): string {
  const base = invoiceNo.normalize('NFKC').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'invoice'}-${today}.${ext}`
}
