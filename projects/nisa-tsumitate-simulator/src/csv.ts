import type { SimulationResult } from './calc'

const UTF8_BOM = '﻿'

export function buildResultsCsv(result: SimulationResult): string {
  const header = ['経過年数', '累計元本(円)', '評価額(円)', '運用益(円)']
  const rows = result.rows.map((r) => [String(r.year), String(r.principalYen), String(r.valueYen), String(r.gainYen)])
  return UTF8_BOM + [header, ...rows].map((c) => c.join(',')).join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(result: SimulationResult): Blob {
  return new Blob([buildResultsCsv(result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `nisa-simulation-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`
}
