import type { SimulationResult } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildResultsCsv(r: SimulationResult, donatedYen: number): string {
  const rows: string[][] = [
    ['項目', '金額(円)'],
    ['給与収入', String(r.salaryYen)],
    ['給与所得', String(r.employmentIncomeYen)],
    ['社会保険料(概算含む)', String(r.socialInsuranceYen)],
    ['所得税の課税所得', String(r.incomeTaxTaxableYen)],
    ['住民税の課税所得', String(r.residentTaxTaxableYen)],
    ['住民税所得割額(概算)', String(r.residentTaxIncomePortionYen)],
    ['控除上限額の目安', String(r.limitYen)],
    ['余裕を見た目安(90%)', String(r.safeLimitYen)],
    ['寄附済み額', String(donatedYen)],
    ['残り寄附可能額の目安', String(r.remainingYen)],
    ['自己負担額', String(r.selfBurdenYen)],
  ]
  return UTF8_BOM + rows.map((cols) => cols.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(r: SimulationResult, donatedYen: number): Blob {
  return new Blob([buildResultsCsv(r, donatedYen)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `furusato-limit-${y}-${m}-${d}.csv`
}
