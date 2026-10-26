import type { SimulationResult, SimulatorInput } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildResultsCsv(input: SimulatorInput, result: SimulationResult): string {
  const header = ['方式', '適用可否', '納付税額(円)', 'うち国税(円)', 'うち地方消費税(円)', '備考']
  const rows = result.methods.map((m) => [
    m.label,
    m.eligible ? '適用可' : '適用不可',
    String(m.totalYen),
    String(m.nationalYen),
    String(m.localYen),
    m.note,
  ])
  const meta = [
    ['対象年分', `${input.taxYear}年分`, '', '', '', ''],
    ['売上税額(円)', String(result.salesTaxYen), '', '', '', ''],
    ['仕入税額(円)', String(result.purchaseTaxYen), '', '', '', ''],
  ]
  const lines = [...meta, header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(input: SimulatorInput, result: SimulationResult): Blob {
  return new Blob([buildResultsCsv(input, result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoice-tax-simulation-${y}-${m}-${d}.csv`
}
