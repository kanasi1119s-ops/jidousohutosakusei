import { calcTotals, type Invoice } from './calc'

const UTF8_BOM = '\uFEFF'

/** 表計算ソフトで式として解釈されうる先頭文字を無害化する（CSVインジェクション対策）。 */
function escapeCsvField(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildInvoiceCsv(inv: Invoice): string {
  const totals = calcTotals(inv.items, inv.priceMode, inv.rounding)
  const amountLabel = inv.priceMode === 'inclusive' ? '金額(税込・円)' : '金額(税抜・円)'
  const header = ['品名', '数量', '単価(円)', '税率', amountLabel]
  const rows = inv.items.map((it, i) => [
    it.name,
    String(it.quantity),
    String(it.unitPrice),
    it.taxRate === 0 ? '非課税' : `${it.taxRate}%`,
    String(totals.lineAmounts[i]),
  ])
  const summary = totals.groups.map((g) => [
    g.rate === 0 ? '非課税対象合計' : `${g.rate}%対象 消費税`,
    '',
    '',
    g.rate === 0 ? '非課税' : `${g.rate}%`,
    String(g.rate === 0 ? g.total : g.tax),
  ])
  const total = ['請求金額合計(税込)', '', '', '', String(totals.total)]
  const lines = [header, ...rows, ...summary, total].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildInvoiceCsvBlob(inv: Invoice): Blob {
  return new Blob([buildInvoiceCsv(inv)], { type: 'text/csv;charset=utf-8' })
}

/** ダウンロードファイル名は英数字・ハイフンのみ（日本語ファイル名はZIP展開などで化けるため使わない）。 */
export function safeFileStem(number: string): string {
  const s = number.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return s || 'draft'
}

export function csvFileName(inv: Invoice): string {
  return `invoice-${safeFileStem(inv.number)}-${inv.issueDate || 'undated'}.csv`
}
