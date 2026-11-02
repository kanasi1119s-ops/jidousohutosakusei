import { isValidDate, newId, type Donation } from './tracker'

const UTF8_BOM = '﻿'
const HEADER = ['自治体名', '寄附日', '寄附額(円)', 'ワンストップ特例希望']

function escapeField(v: string): string {
  // 表計算ソフトの数式として解釈されないよう先頭の記号を無効化する
  const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
}

export function buildDonationsCsv(donations: Donation[]): string {
  const rows = donations.map((d) => [d.municipality, d.date, String(d.amountYen), d.oneStop ? '希望' : '希望しない'])
  return UTF8_BOM + [HEADER, ...rows].map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n'
}

export function buildDonationsCsvBlob(donations: Donation[]): Blob {
  return new Blob([buildDonationsCsv(donations)], { type: 'text/csv;charset=utf-8' })
}

export function csvFileName(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `furusato-donations-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`
}

export function parseCsvRows(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((x) => x !== '')) rows.push(row)
  }
  return rows
}

export function parseDonationsCsv(text: string): Donation[] {
  const rows = parseCsvRows(text)
  if (rows.length === 0 || rows[0][0] !== HEADER[0]) {
    throw new Error('CSVの形式が不正です（先頭の列見出しが「自治体名」ではありません）。')
  }
  if (rows.length > 5001) throw new Error('行数が多すぎます（5,000件以下にしてください）。')
  return rows.slice(1).map((r, idx) => {
    const line = idx + 2
    const amount = Number(r[2]?.normalize('NFKC').replace(/,/g, ''))
    const date = (r[1] ?? '').normalize('NFKC').trim()
    if (!isValidDate(date)) throw new Error(`${line}行目: 寄附日が不正です。`)
    if (!Number.isInteger(amount) || amount < 1) throw new Error(`${line}行目: 寄附額が不正です。`)
    const name = (r[0] ?? '').replace(/^'(?=[=+\-@])/, '').trim()
    if (name === '' || name.length > 60) throw new Error(`${line}行目: 自治体名が不正です。`)
    return { id: newId(), municipality: name, date, amountYen: amount, oneStop: (r[3] ?? '') !== '希望しない' }
  })
}
