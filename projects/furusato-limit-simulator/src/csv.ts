import type { SimulationResult } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

export function buildResultsCsv(r: SimulationResult): string {
  const rows: string[][] = [
    ['項目', '金額(円)'],
    ['給与収入', String(r.salaryYen)],
    ['給与所得控除', String(r.salaryDeductionYen)],
    ['給与所得', String(r.incomeYen)],
    ['社会保険料(概算含む)', String(r.socialInsuranceYen)],
    ['所得税の課税所得', String(r.incomeTaxableYen)],
    ['所得税率(%)', String(Math.round(r.incomeTaxRate * 100))],
    ['住民税の課税所得', String(r.residentTaxableYen)],
    ['調整控除', String(r.adjustmentDeductionYen)],
    ['住民税所得割額', String(r.residentIncomeLevyYen)],
    ['ふるさと納税 控除上限額の目安', String(r.limitYen)],
    ['返礼品の受取額の参考値(還元率30%)', String(r.giftReferenceYen)],
  ]
  return UTF8_BOM + rows.map((cols) => cols.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(r: SimulationResult): Blob {
  return new Blob([buildResultsCsv(r)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `furusato-limit-${y}-${m}-${d}.csv`
}
