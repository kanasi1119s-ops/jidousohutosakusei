import type { SimulationResult } from './calc'

const UTF8_BOM = '﻿'

export function buildResultsCsv(result: SimulationResult): string {
  const header = [
    '経過年数',
    '元本累計(円)',
    'NISA評価額(円)',
    '運用益(円)',
    '課税口座手取り(円)',
    '非課税効果の目安(円)',
    '実質価値(円)',
  ]
  const rows = result.rows.map((r) =>
    [
      r.year,
      r.principalYen,
      r.nisaValueYen,
      r.gainYen,
      r.taxableNetYen,
      r.taxSavedYen,
      r.realValueYen,
    ].map((v) => String(Math.round(v))),
  )
  const lines = [header, ...rows].map((cols) => cols.join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(result: SimulationResult): Blob {
  return new Blob([buildResultsCsv(result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `nisa-simulation-${y}-${m}-${d}.csv`
}
