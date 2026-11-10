export type Method = 'onestop' | 'kakutei'

export interface Donation {
  id: string
  /** YYYY-MM-DD */
  date: string
  municipality: string
  amountYen: number
  method: Method
  /** ワンストップ特例の申請書を送付済みか */
  sent: boolean
}

export interface LedgerSummary {
  totalYen: number
  remainingYen: number
  overYen: number
  count: number
  onestopMunicipalities: number
  onestopLimitExceeded: boolean
  unsentOnestop: number
  deadline: string
  daysToDonationEnd: number
  daysToOnestopDeadline: number
  ignoredCount: number
}

export function normalizeMunicipality(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, '').trim()
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateDonation(d: Pick<Donation, 'date' | 'municipality' | 'amountYen'>): string[] {
  const errors: string[] = []
  if (!isValidDate(d.date)) errors.push('寄付日はYYYY-MM-DD形式の正しい日付で入力してください。')
  if (!normalizeMunicipality(d.municipality)) errors.push('自治体名を入力してください。')
  if (!Number.isFinite(d.amountYen) || d.amountYen <= 0 || !Number.isInteger(d.amountYen)) {
    errors.push('寄付金額は1以上の整数で入力してください。')
  }
  return errors
}

function dayDiff(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + 'T00:00:00Z')
  const b = Date.parse(toIso + 'T00:00:00Z')
  return Math.round((b - a) / 86_400_000)
}

export function summarize(donations: Donation[], year: number, limitYen: number, todayIso: string): LedgerSummary {
  const inYear = donations.filter((d) => d.date.startsWith(`${year}-`))
  const total = inYear.reduce((s, d) => s + d.amountYen, 0)
  const onestop = inYear.filter((d) => d.method === 'onestop')
  const munis = new Set(onestop.map((d) => normalizeMunicipality(d.municipality)))
  const unsentMunis = new Set(onestop.filter((d) => !d.sent).map((d) => normalizeMunicipality(d.municipality)))
  const deadline = `${year + 1}-01-10`
  return {
    totalYen: total,
    remainingYen: Math.max(limitYen - total, 0),
    overYen: Math.max(total - limitYen, 0),
    count: inYear.length,
    onestopMunicipalities: munis.size,
    onestopLimitExceeded: munis.size > 5,
    unsentOnestop: unsentMunis.size,
    deadline,
    daysToDonationEnd: dayDiff(todayIso, `${year}-12-31`),
    daysToOnestopDeadline: dayDiff(todayIso, deadline),
    ignoredCount: donations.length - inYear.length,
  }
}
