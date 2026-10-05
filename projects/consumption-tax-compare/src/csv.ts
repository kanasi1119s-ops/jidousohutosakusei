import type { TaxInput, TaxResult } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildResultsCsv(input: TaxInput, result: TaxResult): string {
  const header = [
    '方式',
    '選択可否(要件上)',
    '推奨',
    '売上に係る消費税額(国税)',
    '控除対象仕入税額(国税)',
    '納付税額(国税)',
    '納付地方消費税額',
    '合計(円・負数は還付)',
    '備考',
  ]
  const rows = result.methods.map((m) => [
    m.label,
    m.available ? '可' : '不可',
    result.recommendedId === m.id ? '★' : '',
    String(m.salesTaxYen),
    String(m.deductionYen),
    String(m.nationalTaxYen),
    String(m.localTaxYen),
    String(m.totalYen),
    m.notes.join(' / '),
  ])
  const meta = [['年分', `${input.year}年分`], ['基準期間の課税売上高(円)', String(input.baseYearSalesYen)]]
  const lines = [...meta, [], header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(input: TaxInput, result: TaxResult): Blob {
  return new Blob([buildResultsCsv(input, result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `consumption-tax-compare-${y}-${m}-${d}.csv`
}
