import { calculate, type CalcResult } from './calc'
import type { Invoice } from './invoice'

const UTF8_BOM = '\uFEFF'

/** 表計算ソフトで数式として解釈されうる先頭文字を無害化する（CSVインジェクション対策）。 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildInvoiceListCsv(invoices: Invoice[]): string {
  const header = [
    '請求書番号',
    '発行日',
    '支払期限',
    '請求先',
    '件名',
    '10%対象(税抜)',
    '10%消費税',
    '8%対象(税抜)',
    '8%消費税',
    '非課税・不課税',
    '合計(税込)',
    '源泉徴収額',
    '請求額',
  ]
  const rows = invoices.map((inv) => {
    const r: CalcResult = calculate(inv)
    const get = (rate: number) => r.perRate.find((p) => p.rate === rate)!
    return [
      neutralizeFormula(inv.number),
      inv.issueDate,
      inv.dueDate,
      neutralizeFormula(inv.recipient),
      neutralizeFormula(inv.subject),
      String(get(10).net),
      String(get(10).tax),
      String(get(8).net),
      String(get(8).tax),
      String(get(0).net),
      String(r.total),
      String(r.withholdingAmount),
      String(r.payable),
    ]
  })
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceListCsvBlob(invoices: Invoice[]): Blob {
  return new Blob([buildInvoiceListCsv(invoices)], { type: 'text/csv;charset=utf-8' })
}

/** インポート時に先頭のBOMを取り除く（将来のCSV取り込み用）。 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function csvFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoice-list-${y}-${m}-${d}.csv`
}

export function jsonFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoice-maker-backup-${y}-${m}-${d}.json`
}
