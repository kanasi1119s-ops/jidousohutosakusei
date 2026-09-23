import type { SimulationResult } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildResultsCsv(result: SimulationResult): string {
  const header = ['しきい値名', '金額(円)', '区分', '状態', '差額(円)', '週あたり上限時間(目安)']
  const rows = result.results.map((r) => [
    r.threshold.label,
    String(r.thresholdYen),
    r.threshold.category === 'tax' ? '税金' : '社会保険',
    r.status === 'over' ? '超過' : '未満',
    String(Math.round(r.diffYen)),
    r.maxWeeklyHoursToStayUnder === null ? '-' : r.maxWeeklyHoursToStayUnder.toFixed(1),
  ])

  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(result: SimulationResult): Blob {
  return new Blob([buildResultsCsv(result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `income-wall-simulation-${y}-${m}-${d}.csv`
}
