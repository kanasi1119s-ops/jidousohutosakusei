import { CREDIT_PERIODS, OLD_CREDIT_PERIODS, findPeriod } from './schedule'

export type Rounding = 'floor' | 'round' | 'ceil'
export type SupplierType = 'qualified' | 'unqualified'

export interface Purchase {
  id: string
  /** 課税仕入れを行った日（YYYY-MM-DD） */
  date: string
  supplier: string
  /** 税込金額（円） */
  amountYen: number
  /** 消費税率（%）: 10 または 8（軽減税率） */
  taxRate: 10 | 8
  supplierType: SupplierType
}

export interface PurchaseResult {
  purchase: Purchase
  periodId: string
  periodLabel: string
  /** 仕入れに含まれる消費税額 */
  taxYen: number
  /** 適用される控除割合（0〜1） */
  ratio: number
  deductibleYen: number
  nonDeductibleYen: number
  /** 改正前スケジュールとの差（改正後 − 改正前、プラスなら改正で有利） */
  diffFromOldYen: number
}

export interface Summary {
  count: number
  totalAmountYen: number
  totalTaxYen: number
  totalDeductibleYen: number
  totalNonDeductibleYen: number
  totalDiffFromOldYen: number
  byPeriod: { periodId: string; periodLabel: string; count: number; taxYen: number; deductibleYen: number }[]
}

export const MAX_AMOUNT_YEN = 1_000_000_000_000

function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差を避けるため、極小値を加えてから丸める
  const v = value + 1e-9
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(value - 1e-9)
  return Math.round(v)
}

/** 税込金額に含まれる消費税額（税率10%なら 10/110、8%なら 8/108） */
export function taxIncluded(amountYen: number, taxRate: 10 | 8, rounding: Rounding): number {
  return applyRounding((amountYen * taxRate) / (100 + taxRate), rounding)
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (y < 1900 || y > 2200) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** 全角数字・全角ハイフン/スラッシュ・カンマを正規化する */
export function normalizeText(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, '/')
    .replace(/[－−ー‐]/g, '-')
    .replace(/[，、]/g, ',')
    .trim()
}

/** 日付文字列（2026/10/1, 2026-10-01, 全角など）を YYYY-MM-DD に正規化。不正なら null */
export function normalizeDate(s: string): string | null {
  const t = normalizeText(s).replace(/\//g, '-')
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (!m) return null
  const out = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return isValidDate(out) ? out : null
}

/** 金額文字列（全角・カンマ・円記号可）を整数に。不正なら null */
export function normalizeAmount(s: string): number | null {
  const t = normalizeText(s).replace(/[,¥円\s]/g, '').replace(/￥/g, '')
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  if (!Number.isSafeInteger(n) || n > MAX_AMOUNT_YEN) return null
  return n
}

export function validatePurchase(p: Purchase): string[] {
  const errors: string[] = []
  if (!isValidDate(p.date)) errors.push('日付は YYYY-MM-DD 形式の正しい日付で入力してください。')
  if (!Number.isSafeInteger(p.amountYen) || p.amountYen < 0) {
    errors.push('税込金額は0以上の整数で入力してください。')
  } else if (p.amountYen > MAX_AMOUNT_YEN) {
    errors.push('税込金額が大きすぎます（1兆円以下で入力してください）。')
  }
  if (p.taxRate !== 10 && p.taxRate !== 8) errors.push('税率は10%または8%を選択してください。')
  if (p.supplierType !== 'qualified' && p.supplierType !== 'unqualified') {
    errors.push('取引先区分が不正です。')
  }
  return errors
}

export function calcPurchase(p: Purchase, rounding: Rounding): PurchaseResult {
  const taxYen = taxIncluded(p.amountYen, p.taxRate, rounding)
  const period = findPeriod(p.date, CREDIT_PERIODS)
  const oldPeriod = findPeriod(p.date, OLD_CREDIT_PERIODS)
  // 適格請求書発行事業者からの仕入れは全額控除。それ以外は経過措置の割合。
  const ratio = p.supplierType === 'qualified' ? 1 : period.ratio
  const oldRatio = p.supplierType === 'qualified' ? 1 : oldPeriod.ratio
  // 控除額は円未満切捨て（保守的な表示）
  const deductibleYen = Math.floor(taxYen * ratio + 1e-9)
  const oldDeductible = Math.floor(taxYen * oldRatio + 1e-9)
  return {
    purchase: p,
    periodId: period.id,
    periodLabel: period.label,
    taxYen,
    ratio,
    deductibleYen,
    nonDeductibleYen: taxYen - deductibleYen,
    diffFromOldYen: deductibleYen - oldDeductible,
  }
}

export function summarize(results: PurchaseResult[]): Summary {
  const s: Summary = {
    count: results.length,
    totalAmountYen: 0,
    totalTaxYen: 0,
    totalDeductibleYen: 0,
    totalNonDeductibleYen: 0,
    totalDiffFromOldYen: 0,
    byPeriod: [],
  }
  const map = new Map<string, Summary['byPeriod'][number]>()
  for (const r of results) {
    s.totalAmountYen += r.purchase.amountYen
    s.totalTaxYen += r.taxYen
    s.totalDeductibleYen += r.deductibleYen
    s.totalNonDeductibleYen += r.nonDeductibleYen
    s.totalDiffFromOldYen += r.diffFromOldYen
    const key = r.periodId
    const cur = map.get(key) ?? { periodId: key, periodLabel: r.periodLabel, count: 0, taxYen: 0, deductibleYen: 0 }
    cur.count += 1
    cur.taxYen += r.taxYen
    cur.deductibleYen += r.deductibleYen
    map.set(key, cur)
  }
  s.byPeriod = CREDIT_PERIODS.filter((p) => map.has(p.id)).map((p) => map.get(p.id)!)
  return s
}

export function calcAll(purchases: Purchase[], rounding: Rounding): { results: PurchaseResult[]; summary: Summary } {
  const results = purchases.map((p) => calcPurchase(p, rounding))
  return { results, summary: summarize(results) }
}
