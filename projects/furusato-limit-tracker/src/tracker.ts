export interface Donation {
  id: string
  municipality: string
  date: string // YYYY-MM-DD
  amountYen: number
  oneStop: boolean
}

export interface TrackerSummary {
  totalYen: number
  count: number
  municipalities: number
  remainingYen: number
  overYen: number
  burdenYen: number
  oneStopOk: boolean
  oneStopIssues: string[]
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateDonation(d: Omit<Donation, 'id'>): string[] {
  const e: string[] = []
  if (d.municipality.trim() === '') e.push('自治体名を入力してください。')
  if (d.municipality.length > 60) e.push('自治体名は60文字以内で入力してください。')
  if (!isValidDate(d.date)) e.push('寄附日は YYYY-MM-DD 形式の正しい日付で入力してください。')
  if (!Number.isFinite(d.amountYen) || d.amountYen < 1) e.push('寄附額は1円以上の数値で入力してください。')
  else if (!Number.isInteger(d.amountYen)) e.push('寄附額は整数で入力してください。')
  else if (d.amountYen > 100_000_000) e.push('寄附額が大きすぎます（1億円以下）。')
  return e
}

export function summarize(donations: Donation[], year: number, limitYen: number): TrackerSummary {
  const inYear = donations.filter((d) => d.date.startsWith(String(year) + '-'))
  const total = inYear.reduce((a, d) => a + d.amountYen, 0)
  const names = new Set(inYear.map((d) => d.municipality.trim()))
  const issues: string[] = []
  if (names.size > 5) issues.push('寄附先が6自治体以上のため、ワンストップ特例は利用できません（確定申告が必要）。')
  if (inYear.some((d) => !d.oneStop)) issues.push('ワンストップ特例を希望しない寄附が含まれています。')
  return {
    totalYen: total,
    count: inYear.length,
    municipalities: names.size,
    remainingYen: Math.max(0, limitYen - total),
    overYen: Math.max(0, total - limitYen),
    burdenYen: total === 0 ? 0 : Math.min(total, 2000) + Math.max(0, total - limitYen),
    oneStopOk: names.size <= 5,
    oneStopIssues: issues,
  }
}

/** 年末までの残り日数（当日を含まない）。年が過去なら負数。 */
export function daysUntilYearEnd(year: number, today: Date): number {
  const end = Date.UTC(year, 11, 31)
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((end - t) / 86_400_000)
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
