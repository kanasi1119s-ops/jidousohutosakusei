import { calcTotals } from './calc'
import type { Invoice } from './model'

const UTF8_BOM = '﻿'

export function escapeCsvField(value: string): string {
  // 表計算ソフトでの数式インジェクションを避けるため、先頭が = + - @ の文字列には ' を付ける
  // （数値列は escape の対象外なので、負の金額は影響を受けない）
  const safe = /^[=+\-@]/.test(value) ? "'" + value : value
  if (/[",\r\n]/.test(safe)) return '"' + safe.replace(/"/g, '""') + '"'
  return safe
}

export function buildInvoiceCsv(inv: Invoice): string {
  const totals = calcTotals(inv.items, inv.rounding, inv.withholding)
  const header = ['請求書番号', '発行日', '請求先', '品名', '数量', '単価(税抜)', '税率', '金額(税抜)']
  const rows = inv.items.map((it, i) => [
    escapeCsvField(inv.number),
    escapeCsvField(inv.issueDate),
    escapeCsvField(inv.clientName),
    escapeCsvField(it.description),
    String(it.quantity),
    String(it.unitPriceYen),
    it.taxRate === 0 ? '非課税' : `${it.taxRate}%`,
    String(totals.lineAmountsYen[i]),
  ])
  const lines = [header.map(escapeCsvField).join(','), ...rows.map((r) => r.join(','))]
  for (const r of totals.byRate) {
    lines.push(
      ['', '', '', r.rate === 0 ? '非課税対象合計' : `${r.rate}%対象合計(消費税)`, '', '', '', String(r.subtotalYen + r.taxYen)]
        .map(escapeCsvField)
        .join(','),
    )
  }
  lines.push(['', '', '', '合計(税込)', '', '', '', String(totals.totalYen)].map(escapeCsvField).join(','))
  if (inv.withholding) {
    lines.push(['', '', '', '源泉徴収税額', '', '', '', String(-totals.withholdingYen)].map(escapeCsvField).join(','))
    lines.push(['', '', '', '差引請求額', '', '', '', String(totals.payableYen)].map(escapeCsvField).join(','))
  }
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

/** CSV インポート時に先頭の BOM を取り除く（現バージョンでは CSV 取り込みは無いが仕様として提供） */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字のみ（日本語ファイル名はZIP展開等で化けるため使わない） */
export function safeFileName(prefix: string, number: string, ext: string, date: string): string {
  const n = number.normalize('NFKC').replace(/[^A-Za-z0-9_-]/g, '').replace(/^[-_]+|[-_]+$/g, '')
  const d = date.replace(/[^0-9-]/g, '') || 'undated'
  return `${prefix}${n ? '-' + n : ''}-${d}.${ext}`
}
