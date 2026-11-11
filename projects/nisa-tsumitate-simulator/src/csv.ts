import type { SimResult } from './calc'

const UTF8_BOM = '﻿'

export function buildCsv(result: SimResult): string {
  const header = ['経過年数', '元本(円)', '評価額(円)', '運用益(円)', '課税口座で運用した場合の税引後評価額(円)']
  const rows = result.rows.map((r) =>
    [r.year, r.principalYen, r.valueYen, r.gainYen, r.taxableAfterTaxYen].map((v) => String(Math.round(v))).join(','),
  )
  return UTF8_BOM + [header.join(','), ...rows].join('\r\n') + '\r\n'
}

export function buildCsvBlob(result: SimResult): Blob {
  return new Blob([buildCsv(result)], { type: 'text/csv;charset=utf-8' })
}

export function csvFileName(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `nisa-simulation-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`
}
