import type { FurusatoInput, FurusatoResult } from './calc'

const UTF8_BOM = '﻿'

function escapeCsvField(value: string): string {
  // 数式インジェクション対策: 先頭が = + - @ の文字列には ' を付ける（数値は対象外）
  const safe = /^[=+\-@]/.test(value) && Number.isNaN(Number(value)) ? "'" + value : value
  if (/[",\r\n]/.test(safe)) return '"' + safe.replace(/"/g, '""') + '"'
  return safe
}

export function buildResultCsv(input: FurusatoInput, r: FurusatoResult): string {
  const rows: string[][] = [
    ['項目', '値'],
    ['給与収入(円)', String(input.annualSalaryYen)],
    ['社会保険料(円)', String(r.socialInsuranceYen)],
    ['その他の所得控除(円)', String(input.otherDeductionsYen)],
    ['配偶者控除', input.spouse === 'deduction' ? 'あり' : 'なし'],
    ['一般の扶養親族(人)', String(input.generalDependents)],
    ['特定扶養親族(人)', String(input.specialDependents)],
    ['給与所得控除(円)', String(r.salaryDeductionYen)],
    ['給与所得(円)', String(r.salaryIncomeYen)],
    ['所得税の課税所得(円)', String(r.incomeTaxTaxableYen)],
    ['所得税率', `${Math.round(r.incomeTaxRate * 100)}%`],
    ['住民税の課税所得(円)', String(r.residentTaxTaxableYen)],
    ['住民税所得割額(調整控除後, 円)', String(r.residentTaxIncomePortionYen)],
    ['控除上限額の目安(円)', String(r.limitYen)],
    ['余裕をみた目安(円)', String(r.safeLimitYen)],
    ['寄附済み額(円)', String(input.alreadyDonatedYen)],
    ['上限額までの残り(円)', String(r.remainingYen)],
  ]
  return UTF8_BOM + rows.map((cols) => cols.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function buildResultCsvBlob(input: FurusatoInput, r: FurusatoResult): Blob {
  return new Blob([buildResultCsv(input, r)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `furusato-limit-${y}-${m}-${d}.csv`
}
