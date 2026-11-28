import { buildQuickTable, type SimulationResult, type SimulatorInput } from './calc'
import { PARAMS_AS_OF } from './params'

const UTF8_BOM = '﻿'

export function escapeCsvField(value: string): string {
  // 数式として解釈されうる先頭文字を無害化（CSVインジェクション対策）
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildResultsCsv(input: SimulatorInput, result: SimulationResult): string {
  const rows: string[][] = [
    ['項目', '値'],
    ['制度パラメータ基準日', PARAMS_AS_OF],
    ['給与収入(円)', String(input.salaryYen)],
    ['給与所得控除(円)', String(result.salaryDeductionYen)],
    ['社会保険料(円)', String(result.socialInsuranceYen)],
    ['住民税の課税所得(円)', String(result.residentTaxableYen)],
    ['所得税率', `${Math.round(result.incomeTaxRate * 100)}%`],
    ['住民税所得割額(円)', String(result.residentTaxIncomePortionYen)],
    ['控除上限額の目安(円)', String(result.limitYen)],
    ['余裕を見た目安(円)', String(result.safeLimitYen)],
    [],
    ['給与収入(万円)', '上限目安(円)', '余裕を見た目安(円)'],
    ...buildQuickTable(input).map((r) => [String(r.salaryYen / 10_000), String(r.limitYen), String(r.safeLimitYen)]),
  ]
  const lines = rows.map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(input: SimulatorInput, result: SimulationResult): Blob {
  return new Blob([buildResultsCsv(input, result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `furusato-limit-${y}-${m}-${d}.csv`
}
