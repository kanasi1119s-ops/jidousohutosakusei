import type { SimulationResult } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildResultsCsv(result: SimulationResult): string {
  const header = ['方式', '利用可否', '売上税額(円)', '控除税額(円)', '納付税額(円)', '有利な方式', '備考']
  const rows = result.methods.map((m) => [
    m.label,
    m.available ? '可' : '不可・要確認',
    String(m.salesTaxYen),
    String(m.deductionYen),
    String(m.payableYen),
    m.id === result.bestId ? '○' : '',
    m.note,
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
  return `consumption-tax-simulation-${y}-${m}-${d}.csv`
}
