import { CATEGORY_LABELS, MAX_AMOUNT_YEN, TAX_RATES, withholdingOf, type Category } from './rules'

export interface Entry {
  id: number
  label: string
  category: Category
  /** 報酬額（消費税抜き）の円 */
  amountYen: number
  taxRatePercent: number
  /** 請求書等で報酬額と消費税額が明確に区分されているか */
  taxSeparated: boolean
}

export interface EntryResult {
  entry: Entry
  consumptionTaxYen: number
  billedYen: number
  subjectYen: number
  withholdingYen: number
  paymentYen: number
}

export interface Totals {
  billedYen: number
  withholdingYen: number
  paymentYen: number
}

/** 全角数字・カンマ・空白・「円」を許容して整数に変換する。不正なら null。 */
export function parseAmount(raw: string): number | null {
  const s = raw.normalize('NFKC').replace(/[,\s円]/g, '')
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

export function validateEntry(e: Omit<Entry, 'id'>): string[] {
  const errors: string[] = []
  if (!Number.isInteger(e.amountYen) || e.amountYen <= 0) errors.push('報酬額は1円以上の整数で入力してください。')
  else if (e.amountYen > MAX_AMOUNT_YEN) errors.push('報酬額が大きすぎます（1,000億円以下で入力してください）。')
  if (!(e.category in CATEGORY_LABELS)) errors.push('区分が不正です。')
  if (!(TAX_RATES as readonly number[]).includes(e.taxRatePercent)) errors.push('消費税率は10%・8%・0%のいずれかです。')
  return errors
}

export function computeEntry(entry: Entry): EntryResult {
  const consumptionTaxYen = Math.floor((entry.amountYen * entry.taxRatePercent) / 100)
  const billedYen = entry.amountYen + consumptionTaxYen
  const subjectYen = entry.taxSeparated ? entry.amountYen : billedYen
  const withholdingYen = withholdingOf(subjectYen)
  return { entry, consumptionTaxYen, billedYen, subjectYen, withholdingYen, paymentYen: billedYen - withholdingYen }
}

export function computeTotals(results: EntryResult[]): Totals {
  return results.reduce<Totals>(
    (t, r) => ({
      billedYen: t.billedYen + r.billedYen,
      withholdingYen: t.withholdingYen + r.withholdingYen,
      paymentYen: t.paymentYen + r.paymentYen,
    }),
    { billedYen: 0, withholdingYen: 0, paymentYen: 0 },
  )
}
