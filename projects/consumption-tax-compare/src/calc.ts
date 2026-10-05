import {
  BUSINESS_TYPES,
  LOCAL_TO_NATIONAL,
  NATIONAL_RATE_REDUCED,
  NATIONAL_RATE_STANDARD,
  SIMPLIFIED_BASE_LIMIT_YEN,
  SPECIAL_BASE_LIMIT_YEN,
  SUPPORTED_YEARS,
  THREE_TENTHS_YEARS,
  TRANSITIONAL_RATES,
  TWO_TENTHS_YEAR,
  type SupportedYear,
} from './rules'

export interface TaxInput {
  year: SupportedYear
  /** インボイス発行事業者の登録を機に免税事業者から課税事業者になった個人事業者か */
  convertedFromExempt: boolean
  /** 基準期間（2年前）の課税売上高（税抜・円） */
  baseYearSalesYen: number
  /** 事業区分（第1〜6種）ごとの課税売上高（税込・円）。標準税率10%。長さ6 */
  sales10: number[]
  /** 事業区分ごとの課税売上高（税込・円）。軽減税率8%。長さ6 */
  sales8: number[]
  /** 適格請求書発行事業者からの課税仕入れ（税込・円）標準税率 */
  purchases10: number
  /** 同・軽減税率 */
  purchases8: number
  /** 免税事業者等からの課税仕入れ（税込・円）。1/1〜9/30 分。標準税率10%として計算 */
  exemptPurchasesFirst: number
  /** 同・10/1〜12/31 分 */
  exemptPurchasesSecond: number
}

export type MethodId = 'standard' | 'simplified' | 'twoTenths' | 'threeTenths'

export interface MethodResult {
  id: MethodId
  label: string
  /** 要件上、この方式を選べる見込みか（届出等の手続きは別途） */
  available: boolean
  notes: string[]
  salesTaxYen: number
  deductionYen: number
  nationalTaxYen: number
  localTaxYen: number
  /** 納付（正）または還付（負）の合計（国税＋地方消費税） */
  totalYen: number
}

export interface TaxResult {
  methods: MethodResult[]
  recommendedId: MethodId | null
  /** 免税事業者等からの仕入で、経過措置により控除できない消費税額（国税分・円） */
  lostDeductionYen: number
}

export const emptyInput = (year: SupportedYear = 2027): TaxInput => ({
  year,
  convertedFromExempt: true,
  baseYearSalesYen: 5_000_000,
  sales10: [0, 0, 0, 0, 0, 0],
  sales8: [0, 0, 0, 0, 0, 0],
  purchases10: 0,
  purchases8: 0,
  exemptPurchasesFirst: 0,
  exemptPurchasesSecond: 0,
})

const MAX_YEN = 1e13

export function validateInput(input: TaxInput): string[] {
  const errors: string[] = []
  if (!(SUPPORTED_YEARS as readonly number[]).includes(input.year)) {
    errors.push('対応していない年分です。')
  }
  const nums: [string, number][] = [
    ['基準期間の課税売上高', input.baseYearSalesYen],
    ['課税仕入（標準税率）', input.purchases10],
    ['課税仕入（軽減税率）', input.purchases8],
    ['免税事業者等からの仕入（1/1〜9/30）', input.exemptPurchasesFirst],
    ['免税事業者等からの仕入（10/1〜12/31）', input.exemptPurchasesSecond],
  ]
  input.sales10.forEach((v, i) => nums.push([`課税売上（第${i + 1}種・10%）`, v]))
  input.sales8.forEach((v, i) => nums.push([`課税売上（第${i + 1}種・8%）`, v]))
  if (input.sales10.length !== 6 || input.sales8.length !== 6) {
    errors.push('事業区分ごとの売上は6区分すべて必要です。')
  }
  for (const [name, v] of nums) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${name}は数値で入力してください。`)
    } else if (v < 0) {
      errors.push(`${name}は0以上で入力してください。`)
    } else if (v > MAX_YEN) {
      errors.push(`${name}が大きすぎます。`)
    }
  }
  return errors
}

// 浮動小数点誤差（例: 0.9999999 → 切り捨てで1段下がる）を避けるため、微小量を加えてから切り捨てる
const floorTo = (v: number, unit: number): number => Math.floor(v / unit + 1e-9) * unit

/** 全角数字・カンマ・円記号を含む文字列を数値に変換する。解釈できなければ NaN */
export function parseYen(raw: string): number {
  const half = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，、円¥￥\s]/g, '')
    .replace(/[．。]/g, '.')
  if (half === '') return 0
  if (!/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

function splitNational(rawValue: number): { national: number; local: number } {
  // 浮動小数点の誤差で100円単位の切り捨てがずれないよう、微小な丸めを先に行う
  const nationalRaw = Math.round(rawValue * 1e6) / 1e6
  if (nationalRaw >= 0) {
    const national = floorTo(nationalRaw, 100)
    const local = floorTo(national * LOCAL_TO_NATIONAL, 100)
    return { national, local }
  }
  const national = Math.trunc(nationalRaw)
  const local = Math.trunc(national * LOCAL_TO_NATIONAL)
  return { national, local }
}

interface SalesTaxBreakdown {
  /** 売上に係る消費税額（国税分・円未満切捨） */
  total: number
  /** 事業区分ごとの売上税額（国税分・端数処理前） */
  perType: number[]
}

function computeSalesTax(input: TaxInput): SalesTaxBreakdown {
  const sum10 = input.sales10.reduce((a, b) => a + b, 0)
  const sum8 = input.sales8.reduce((a, b) => a + b, 0)
  const tax10 = floorTo((sum10 * 100) / 110, 1000) * NATIONAL_RATE_STANDARD
  const tax8 = floorTo((sum8 * 100) / 108, 1000) * NATIONAL_RATE_REDUCED
  const perType = input.sales10.map((s10, i) => {
    const part10 = sum10 > 0 ? (tax10 * s10) / sum10 : 0
    const part8 = sum8 > 0 ? (tax8 * input.sales8[i]) / sum8 : 0
    return part10 + part8
  })
  return { total: Math.floor(tax10 + tax8), perType }
}

function standardDeduction(input: TaxInput): { deduction: number; lost: number } {
  const [rateFirst, rateSecond] = TRANSITIONAL_RATES[input.year]
  const full10 = (v: number) => (v * NATIONAL_RATE_STANDARD) / 1.1
  const regular = full10(input.purchases10) + (input.purchases8 * NATIONAL_RATE_REDUCED) / 1.08
  const exemptFull = full10(input.exemptPurchasesFirst) + full10(input.exemptPurchasesSecond)
  const exemptDeduct =
    full10(input.exemptPurchasesFirst) * rateFirst + full10(input.exemptPurchasesSecond) * rateSecond
  return {
    deduction: Math.floor(regular + exemptDeduct),
    lost: Math.floor(exemptFull - exemptDeduct),
  }
}

/** 簡易課税の控除対象仕入税額（国税分）。原則計算と75%ルール（特例計算）のうち有利な方を採用する */
export function simplifiedDeduction(perType: number[]): { deduction: number; note: string } {
  const rates = BUSINESS_TYPES.map((b) => b.deemedRate)
  const total = perType.reduce((a, b) => a + b, 0)
  if (total <= 0) return { deduction: 0, note: '売上がないため控除額は0です。' }

  let best = perType.reduce((acc, t, i) => acc + t * rates[i], 0)
  let note = '事業区分ごとのみなし仕入率で計算（原則）'

  for (let i = 0; i < 6; i++) {
    if (perType[i] / total >= 0.75) {
      const d = total * rates[i]
      if (d > best) {
        best = d
        note = `第${i + 1}種の売上が75%以上のため、全体に第${i + 1}種のみなし仕入率を適用（特例）`
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      if (i === j || rates[i] < rates[j]) continue
      if ((perType[i] + perType[j]) / total >= 0.75) {
        // i: 率の高い区分、j: 率の低い区分。i の売上は i の率、それ以外はすべて j の率を適用
        const d = perType[i] * rates[i] + (total - perType[i]) * rates[j]
        if (d > best) {
          best = d
          note = `第${i + 1}種と第${j + 1}種の合計が75%以上のため、2事業区分の特例計算を適用`
        }
      }
    }
  }
  return { deduction: Math.floor(best), note }
}

export function compute(input: TaxInput): TaxResult {
  const sales = computeSalesTax(input)
  const std = standardDeduction(input)
  const base = input.baseYearSalesYen

  const make = (
    id: MethodId,
    label: string,
    available: boolean,
    notes: string[],
    deduction: number,
  ): MethodResult => {
    const { national, local } = splitNational(sales.total - deduction)
    return {
      id,
      label,
      available,
      notes,
      salesTaxYen: sales.total,
      deductionYen: deduction,
      nationalTaxYen: national,
      localTaxYen: local,
      totalYen: national + local,
    }
  }

  const simp = simplifiedDeduction(sales.perType)
  const simpNotes = [simp.note]
  const simpAvail = base <= SIMPLIFIED_BASE_LIMIT_YEN
  if (!simpAvail) simpNotes.push('基準期間の課税売上高が5,000万円を超えるため選択できません。')
  else simpNotes.push(`適用には「簡易課税制度選択届出書」の事前提出が必要です（${input.year - 1}年12月31日まで）。`)

  const stdNotes = ['実際の課税仕入れ等に基づく原則の計算方法です。']
  if (input.exemptPurchasesFirst + input.exemptPurchasesSecond > 0) {
    stdNotes.push(`免税事業者等からの仕入に経過措置の控除割合を適用しています（控除できない消費税額 約${std.lost.toLocaleString('ja-JP')}円）。`)
  }

  const twoNotes: string[] = []
  const twoAvail =
    input.year === TWO_TENTHS_YEAR && input.convertedFromExempt && base <= SPECIAL_BASE_LIMIT_YEN
  if (input.year !== TWO_TENTHS_YEAR) twoNotes.push('2割特例は個人事業者の場合、令和8年分（2026年）が最後です。')
  if (!input.convertedFromExempt) twoNotes.push('登録を機に免税事業者から課税事業者になった方が対象です。')
  if (base > SPECIAL_BASE_LIMIT_YEN) twoNotes.push('基準期間の課税売上高が1,000万円を超えるため対象外です。')
  if (twoAvail) twoNotes.push('納付税額を売上税額の2割とする特例です。')

  const threeNotes: string[] = []
  const threeAvail =
    THREE_TENTHS_YEARS.includes(input.year) && input.convertedFromExempt && base <= SPECIAL_BASE_LIMIT_YEN
  if (!THREE_TENTHS_YEARS.includes(input.year)) threeNotes.push('3割特例は個人事業者の令和9年分・令和10年分（2027〜2028年）のみです。法人は対象外です。')
  if (!input.convertedFromExempt) threeNotes.push('登録を機に免税事業者から課税事業者になった個人事業者が対象です。')
  if (base > SPECIAL_BASE_LIMIT_YEN) threeNotes.push('基準期間の課税売上高が1,000万円を超えるため対象外です。')
  if (threeAvail) threeNotes.push('納付税額を売上税額の3割とする特例です。')

  const methods: MethodResult[] = [
    make('standard', '本則課税', true, stdNotes, std.deduction),
    make('simplified', '簡易課税', simpAvail, simpNotes, simp.deduction),
    make('twoTenths', '2割特例', twoAvail, twoNotes, sales.total - (sales.total * 2) / 10),
    make('threeTenths', '3割特例', threeAvail, threeNotes, sales.total - (sales.total * 3) / 10),
  ]

  const candidates = methods.filter((m) => m.available)
  const best = candidates.reduce<MethodResult | null>(
    (acc, m) => (acc === null || m.totalYen < acc.totalYen ? m : acc),
    null,
  )
  return { methods, recommendedId: best ? best.id : null, lostDeductionYen: std.lost }
}
