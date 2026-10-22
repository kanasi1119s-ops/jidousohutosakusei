import type { InvoiceCalc } from './calc'
import { formatMilli, parseMilli } from './calc'
import type { InvoiceDoc } from './types'

export const UTF8_BOM = '﻿'

/** 表計算ソフトで数式として解釈されうる先頭文字を無効化する（CSVインジェクション対策） */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value
}

export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

function textCell(value: string): string {
  return escapeCsvField(neutralize(value))
}

export function buildItemsCsv(doc: InvoiceDoc, calc: InvoiceCalc): string {
  const rows: string[] = []
  rows.push(['品名', '数量', '単価(円)', '税率(%)', '金額(税抜・円)'].join(','))
  doc.items.forEach((it, i) => {
    const line = calc.lines[i]
    if (!line || line.status !== 'ok') return
    const q = parseMilli(it.quantity)
    const u = parseMilli(it.unitPrice)
    rows.push(
      [
        textCell(it.description),
        q === null ? '' : formatMilli(q).replace(/,/g, ''),
        u === null ? '' : formatMilli(u).replace(/,/g, ''),
        String(it.taxRate),
        String(line.amount),
      ].join(','),
    )
  })
  for (const b of calc.byRate) {
    rows.push([textCell(`税率${b.rate}%対象額`), '', '', String(b.rate), String(b.subtotal)].join(','))
    rows.push([textCell(`税率${b.rate}%消費税額`), '', '', String(b.rate), String(b.tax)].join(','))
  }
  rows.push([textCell('合計(税込)'), '', '', '', String(calc.total)].join(','))
  if (calc.withholding > 0) {
    rows.push([textCell('源泉徴収税額'), '', '', '', String(-calc.withholding)].join(','))
    rows.push([textCell('差引請求額'), '', '', '', String(calc.payable)].join(','))
  }
  return UTF8_BOM + rows.join('\r\n') + '\r\n'
}

export function buildItemsCsvBlob(doc: InvoiceDoc, calc: InvoiceCalc): Blob {
  return new Blob([buildItemsCsv(doc, calc)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字・ハイフンのみ */
export function csvFileName(date: string): string {
  return `invoice-items-${date.replace(/[^0-9-]/g, '') || 'export'}.csv`
}

export function jsonFileName(date: string): string {
  return `invoice-maker-data-${date.replace(/[^0-9-]/g, '') || 'export'}.json`
}
