import { calcInvoice } from './calc'
import type { Invoice } from './types'

const UTF8_BOM = '\uFEFF'

/** Excel での数式実行（CSVインジェクション）を避けるため、文字列が = + - @ で始まる場合は先頭に ' を付ける。 */
function escapeCsvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value
  return escapeCsvField(safe)
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
}

export function buildInvoiceCsv(inv: Invoice): string {
  const t = calcInvoice(inv)
  const unitLabel = inv.priceMode === 'exclusive' ? '金額(税抜)' : '金額(税込)'
  const header = ['請求書番号', '発行日', '請求先', '品名', '数量', '単価', '税率(%)', unitLabel]
  const rows: string[][] = inv.items.map((it, i) => [
    escapeCsvText(inv.invoiceNumber),
    inv.issueDate,
    escapeCsvText(inv.clientName),
    escapeCsvText(it.name),
    String(it.quantity),
    String(it.unitPrice),
    String(it.taxRate),
    String(t.lines[i]),
  ])
  const lines = [header.map(escapeCsvField), ...rows]
  const summary: string[][] = []
  for (const r of t.byRate) {
    summary.push(['', '', '', `${r.rate}%対象 税抜合計`, '', '', String(r.rate), String(r.net)])
    summary.push(['', '', '', `${r.rate}%対象 消費税`, '', '', String(r.rate), String(r.tax)])
  }
  summary.push(['', '', '', '合計(税込)', '', '', '', String(t.gross)])
  if (inv.withholdingEnabled) {
    summary.push(['', '', '', '源泉徴収税額', '', '', '', String(t.withholding)])
    summary.push(['', '', '', '差引請求額', '', '', '', String(t.payable)])
  }
  const all = [...lines.map((cols) => cols.join(',')), ...summary.map((cols) => cols.map(escapeCsvField).join(','))]
  return UTF8_BOM + all.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロード名は英数字・ハイフン・アンダースコアのみ（日本語名は展開時に化けるため使わない）。 */
export function safeFileStem(invoiceNumber: string, fallback: string): string {
  const s = invoiceNumber.normalize('NFKC').replace(/[^A-Za-z0-9_-]/g, '')
  return s === '' ? fallback : s.slice(0, 40)
}

export function csvDownloadFileName(inv: Invoice): string {
  return `invoice-${safeFileStem(inv.invoiceNumber, 'draft')}-${inv.issueDate || 'nodate'}.csv`
}
