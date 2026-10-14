import { normalizeAmount, normalizeDate, normalizeText, type Purchase, type PurchaseResult } from './calc'

const UTF8_BOM = '﻿'

/** CSVインジェクション対策: 式として解釈され得る先頭文字の前にシングルクォートを付ける */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

export const CSV_HEADER = ['日付', '取引先', '税込金額', '税率', '取引先区分']
const EXPORT_HEADER = [...CSV_HEADER, '消費税額', '控除割合(%)', '控除可能額', '控除不可額', '適用期間']

function typeLabel(t: Purchase['supplierType']): string {
  return t === 'qualified' ? '適格' : '免税等'
}

export function buildResultsCsv(results: PurchaseResult[]): string {
  const rows = results.map((r) => [
    r.purchase.date,
    neutralizeFormula(r.purchase.supplier),
    String(r.purchase.amountYen),
    String(r.purchase.taxRate),
    typeLabel(r.purchase.supplierType),
    String(r.taxYen),
    String(Math.round(r.ratio * 100)),
    String(r.deductibleYen),
    String(r.nonDeductibleYen),
    r.periodLabel,
  ])
  const lines = [EXPORT_HEADER, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildTemplateCsv(): string {
  const rows = [
    CSV_HEADER,
    ['2026-09-30', 'サンプル商店', '11000', '10', '免税等'],
    ['2026-10-01', 'サンプル食品', '10800', '8', '免税等'],
    ['2026-10-15', 'サンプル運送', '22000', '10', '適格'],
  ]
  return UTF8_BOM + rows.map((cols) => cols.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}

export function csvBlob(text: string): Blob {
  return new Blob([text], { type: 'text/csv;charset=utf-8' })
}

export function ymd(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function csvDownloadFileName(date: Date = new Date()): string {
  return `invoice-credit-${ymd(date)}.csv`
}

/** RFC4180風のCSV分割（引用符・引用符内の改行・""エスケープに対応） */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

export const MAX_IMPORT_ROWS = 5000

export interface ImportOutcome {
  purchases: Purchase[]
  errors: string[]
}

function parseType(s: string): Purchase['supplierType'] | null {
  const t = normalizeText(s)
  if (['適格', '適格請求書発行事業者', 'qualified'].includes(t)) return 'qualified'
  if (['免税等', '免税', '非適格', '免税事業者', 'unqualified'].includes(t)) return 'unqualified'
  return null
}

export function parsePurchasesCsv(text: string, newId: () => string): ImportOutcome {
  const rows = parseCsv(text)
  const errors: string[] = []
  const purchases: Purchase[] = []
  if (rows.length === 0) return { purchases, errors: ['CSVが空です。'] }
  const hasHeader = rows[0][0]?.trim() === CSV_HEADER[0]
  const body = hasHeader ? rows.slice(1) : rows
  if (body.length > MAX_IMPORT_ROWS) {
    return { purchases, errors: [`行数が多すぎます（${MAX_IMPORT_ROWS}行まで）。`] }
  }
  body.forEach((cols, idx) => {
    const line = idx + (hasHeader ? 2 : 1)
    if (cols.length < 5) {
      errors.push(`${line}行目: 列数が不足しています（5列必要: ${CSV_HEADER.join(',')}）。`)
      return
    }
    const date = normalizeDate(cols[0])
    const amount = normalizeAmount(cols[2])
    const rateNum = Number(normalizeText(cols[3]).replace('%', ''))
    const type = parseType(cols[4])
    if (!date) return void errors.push(`${line}行目: 日付が不正です（${cols[0]}）。`)
    if (amount === null) return void errors.push(`${line}行目: 税込金額が不正です（${cols[2]}）。`)
    if (rateNum !== 10 && rateNum !== 8) return void errors.push(`${line}行目: 税率は10か8で指定してください（${cols[3]}）。`)
    if (!type) return void errors.push(`${line}行目: 取引先区分は「適格」か「免税等」で指定してください（${cols[4]}）。`)
    purchases.push({
      id: newId(),
      date,
      supplier: cols[1].trim().replace(/^'(?=[=+\-@])/, '').slice(0, 100),
      amountYen: amount,
      taxRate: rateNum,
      supplierType: type,
    })
  })
  return { purchases, errors }
}
