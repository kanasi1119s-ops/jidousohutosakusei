import type { Donation } from './donations'

const UTF8_BOM = '﻿'

export function escapeCsvField(value: string): string {
  // CSVインジェクション対策: 先頭が数式開始文字なら先頭にシングルクォートを付与
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

export function buildDonationsCsv(list: Donation[]): string {
  const header = ['寄附日', '自治体名', '寄附額(円)', 'ワンストップ特例申請書送付']
  const rows = [...list]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => [d.date, d.municipality, String(d.amountYen), d.oneStopSent ? '送付済み' : '未送付'])
  const lines = [header, ...rows].map((cols) => cols.map(escapeCsvField).join(','))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

export function buildDonationsCsvBlob(list: Donation[]): Blob {
  return new Blob([buildDonationsCsv(list)], { type: 'text/csv;charset=utf-8' })
}

export function csvDownloadFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `furusato-donations-${y}-${m}-${d}.csv`
}
