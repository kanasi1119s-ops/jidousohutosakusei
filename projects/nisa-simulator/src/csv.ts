import type { NisaResult } from './calc'

const UTF8_BOM = '﻿'

export function buildResultsCsv(r: NisaResult): string {
  const header = ['経過年', '元本(円)', '評価額(円)', '運用益(円)', '非課税メリット(円)']
  const rows = r.rows.map((x) => [x.year, x.principalYen, x.valueYen, x.gainYen, x.taxSavedYen].map(String))
  return UTF8_BOM + [header, ...rows].map((c) => c.join(',')).join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(r: NisaResult): Blob {
  return new Blob([buildResultsCsv(r)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `nisa-simulation-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`
}
