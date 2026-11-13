export interface Donation {
  id: string
  /** 寄附（決済完了）日 YYYY-MM-DD */
  date: string
  municipality: string
  amountYen: number
  /** ワンストップ特例申請書を送付済みか */
  oneStopSent: boolean
}

export const ONE_STOP_MAX_MUNICIPALITIES = 5

export function validateDonation(d: Omit<Donation, 'id' | 'oneStopSent'>): string[] {
  const errors: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(Date.parse(d.date))) {
    errors.push('寄附日は日付で入力してください。')
  }
  if (d.municipality.trim() === '') errors.push('自治体名を入力してください。')
  if (d.municipality.length > 50) errors.push('自治体名は50文字以内で入力してください。')
  if (!Number.isInteger(d.amountYen) || d.amountYen < 1000) {
    errors.push('寄附額は1,000円以上の整数で入力してください。')
  }
  if (d.amountYen > 100_000_000) errors.push('寄附額は1億円以下で入力してください。')
  return errors
}

export function totalForYear(list: Donation[], year: number): number {
  return list.filter((d) => d.date.startsWith(`${year}-`)).reduce((s, d) => s + d.amountYen, 0)
}

export function distinctMunicipalities(list: Donation[], year: number): number {
  return new Set(list.filter((d) => d.date.startsWith(`${year}-`)).map((d) => d.municipality.trim())).size
}

export interface Status {
  total: number
  remainingYen: number
  overYen: number
  municipalities: number
  oneStopWarning: boolean
}

export function summarize(list: Donation[], year: number, limitYen: number | null): Status {
  const total = totalForYear(list, year)
  const municipalities = distinctMunicipalities(list, year)
  const diff = limitYen === null ? 0 : limitYen - total
  return {
    total,
    remainingYen: Math.max(0, diff),
    overYen: limitYen === null ? 0 : Math.max(0, -diff),
    municipalities,
    oneStopWarning: municipalities > ONE_STOP_MAX_MUNICIPALITIES,
  }
}
