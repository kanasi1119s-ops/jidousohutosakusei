export function formatYen(n: number): string {
  const abs = Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (n < 0 ? '-' : '') + '¥' + abs
}

export function formatNumber(n: number): string {
  const [int, frac] = String(n).split('.')
  const head = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${head}.${frac}` : head
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function formatDateJa(s: string): string {
  const m = DATE_RE.exec(s)
  if (!m || !isValidDate(s)) return ''
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
