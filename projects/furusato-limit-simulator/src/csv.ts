import type { FurusatoInput, FurusatoResult } from './calc'
import { salaryTable } from './calc'

const UTF8_BOM = '﻿'

function esc(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

export function buildCsv(input: FurusatoInput, result: FurusatoResult): string {
  const rows: string[][] = [
    ['項目', '金額(円)'],
    ['給与収入', String(input.salaryYen)],
    ['給与所得', String(result.salaryIncomeYen)],
    ['社会保険料', String(result.socialInsuranceYen)],
    ['所得税の課税所得', String(result.incomeTaxableYen)],
    ['住民税の課税所得', String(result.residentTaxableYen)],
    ['所得税率(%)', String(Math.round(result.incomeTaxRate * 100))],
    ['住民税所得割額', String(result.residentTaxIncomePortionYen)],
    ['寄附上限額の目安', String(result.limitYen)],
    ['余裕を持った目安(90%)', String(result.safeLimitYen)],
    ['寄附済み金額', String(input.alreadyDonatedYen)],
    ['残りの寄附可能額', String(result.remainingYen)],
    ['自己負担額', String(result.selfPaymentYen)],
    [],
    ['年収別の上限額の目安（他の条件は同じ）'],
    ['給与収入(円)', '上限額の目安(円)'],
    ...salaryTable(input).map((r) => [String(r.salaryYen), String(r.limitYen)]),
  ]
  return UTF8_BOM + rows.map((cols) => cols.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildCsvBlob(input: FurusatoInput, result: FurusatoResult): Blob {
  return new Blob([buildCsv(input, result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `furusato-limit-${y}-${m}-${d}.csv`
}
