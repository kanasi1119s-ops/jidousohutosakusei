import type { Donation, Method } from './ledger'
import { isValidDate } from './ledger'

const UTF8_BOM = '﻿'
export const CSV_HEADER = ['寄付日', '自治体名', '金額(円)', '申請方法', '申請書送付済み']

function esc(v: string): string {
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

export function buildDonationsCsv(list: Donation[]): string {
  const rows = list.map((d) => [
    d.date,
    d.municipality,
    String(d.amountYen),
    d.method === 'onestop' ? 'ワンストップ' : '確定申告',
    d.method === 'onestop' ? (d.sent ? '済' : '未') : '-',
  ])
  return UTF8_BOM + [CSV_HEADER, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function buildDonationsCsvBlob(list: Donation[]): Blob {
  return new Blob([buildDonationsCsv(list)], { type: 'text/csv;charset=utf-8' })
}

export function csvFileName(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `furusato-donations-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`
}

/** RFC4180風の簡易パーサ（引用符・改行を含むフィールドに対応） */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

export function parseDonationsCsv(text: string, newId: () => string): Donation[] {
  const rows = parseCsv(text)
  if (rows.length === 0 || rows[0][0] !== CSV_HEADER[0]) {
    throw new Error('CSVの形式が不正です（ヘッダー行が一致しません）。')
  }
  return rows.slice(1).map((r, idx) => {
    const line = idx + 2
    const amount = Number(r[2])
    if (!isValidDate(r[0] ?? '')) throw new Error(`${line}行目: 寄付日が不正です。`)
    if (!(r[1] ?? '').trim()) throw new Error(`${line}行目: 自治体名が空です。`)
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`${line}行目: 金額が不正です。`)
    const method: Method = r[3] === 'ワンストップ' ? 'onestop' : 'kakutei'
    return { id: newId(), date: r[0], municipality: r[1].trim(), amountYen: amount, method, sent: r[4] === '済' }
  })
}
