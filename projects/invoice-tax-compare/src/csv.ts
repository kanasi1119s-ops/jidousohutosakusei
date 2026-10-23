import type { CompareResult } from './calc'

const UTF8_BOM = '\uFEFF'

function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

export function buildResultsCsv(result: CompareResult): string {
  const header = ['方式', '適用可否', '国税(円)', '地方消費税(円)', '合計(円・マイナスは還付)', '推奨', '備考']
  const rows = result.methods.map((m) => [
    m.label,
    m.eligible ? '可' : '不可',
    String(m.isRefund ? -m.nationalYen : m.nationalYen),
    String(m.isRefund ? -m.localYen : m.localYen),
    String(m.totalYen),
    m.id === result.bestId ? '○' : '',
    m.reason,
  ])
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildResultsCsvBlob(result: CompareResult): Blob {
  return new Blob([buildResultsCsv(result)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `invoice-tax-compare-${y}-${m}-${d}.csv`
}
