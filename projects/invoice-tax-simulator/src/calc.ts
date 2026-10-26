import {
  DEEMED_PURCHASE_RATE,
  LOCAL_SHARE,
  NATIONAL_SHARE,
  RATE_REDUCED,
  RATE_STANDARD,
  SIMPLIFIED_LIMIT_YEN,
  SPECIAL_LABEL,
  SPECIAL_LIMIT_YEN,
  SPECIAL_RATE_PERCENT,
  TAX_YEARS,
  TRANSITIONAL_RATIOS,
  type TaxYear,
} from './thresholds'

export interface SimulatorInput {
  taxYear: TaxYear
  /** 基準期間（前々年）の課税売上高（税抜・円） */
  baseSalesYen: number
  /** インボイス発行事業者として登録済みか */
  registered: boolean
  /** 課税売上高（税込・円） */
  sales10Yen: number
  sales8Yen: number
  /** 課税仕入高（税込・円）。インボイス保存あり等で全額控除できるもの */
  purchases10Yen: number
  purchases8Yen: number
  /** 免税事業者等からの課税仕入高（税込・10%・円） */
  exemptPurchasesYen: number
  /** 上記に適用する経過措置の控除割合（%） */
  transitionalRatio: number
  /** 簡易課税の事業区分（1〜6） */
  businessType: number
}

export type MethodId = 'special' | 'simplified' | 'general' | 'exempt'

export interface MethodResult {
  id: MethodId
  label: string
  eligible: boolean
  /** 納付税額（消費税+地方消費税、円）。還付の場合は負の値 */
  totalYen: number
  nationalYen: number
  localYen: number
  note: string
}

export interface SimulationResult {
  salesTaxYen: number
  purchaseTaxYen: number
  methods: MethodResult[]
  /** 適用可能な方式のうち納付額が最小のもの（免税事業者は参考扱いで含めない） */
  bestId: MethodId | null
}

const MAX_YEN = 1_000_000_000_000

/** 全角数字・カンマ・「円」等を許容して数値に変換する。不正なら NaN */
export function parseYen(text: string): number {
  const normalized = text
    .normalize('NFKC')
    .replace(/[,\s円¥]/g, '')
    .replace(/^[+]/, '')
  if (normalized === '') return NaN
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN
  return Number(normalized)
}

export function validateInput(input: SimulatorInput): string[] {
  const errors: string[] = []
  const moneyFields: Array<[keyof SimulatorInput, string]> = [
    ['baseSalesYen', '基準期間の課税売上高'],
    ['sales10Yen', '課税売上高（10%）'],
    ['sales8Yen', '課税売上高（軽減8%）'],
    ['purchases10Yen', '課税仕入高（10%）'],
    ['purchases8Yen', '課税仕入高（軽減8%）'],
    ['exemptPurchasesYen', '免税事業者等からの課税仕入高'],
  ]
  for (const [key, label] of moneyFields) {
    const v = input[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${label}は数値で入力してください。`)
    } else if (v < 0) {
      errors.push(`${label}は0以上で入力してください。`)
    } else if (v > MAX_YEN) {
      errors.push(`${label}が大きすぎます（1兆円以下で入力してください）。`)
    }
  }
  if (!TAX_YEARS.includes(input.taxYear)) {
    errors.push('対象年分は2026〜2028年から選択してください。')
  }
  if (!TRANSITIONAL_RATIOS.includes(input.transitionalRatio)) {
    errors.push('経過措置の控除割合が不正です。')
  }
  if (!(input.businessType in DEEMED_PURCHASE_RATE)) {
    errors.push('簡易課税の事業区分が不正です。')
  }
  if (typeof input.registered !== 'boolean') {
    errors.push('インボイス登録の有無が不正です。')
  }
  return errors
}

/** 税込金額から税額を求める（円未満切り捨て） */
function taxPortion(taxInclusive: number, ratePercent: number): number {
  return Math.floor((taxInclusive * ratePercent) / (100 + ratePercent))
}

/** 納付税額（合計）を国税・地方税に分け、それぞれ100円未満を切り捨てる（正の値のみ） */
export function splitAndRound(totalYen: number): { total: number; national: number; local: number } {
  if (totalYen <= 0) return { total: Math.ceil(totalYen), national: Math.ceil(totalYen), local: 0 }
  const nationalRaw = Math.floor((totalYen * NATIONAL_SHARE) / (NATIONAL_SHARE + LOCAL_SHARE))
  const national = Math.floor(nationalRaw / 100) * 100
  const local = Math.floor(Math.floor((national * LOCAL_SHARE) / NATIONAL_SHARE) / 100) * 100
  return { total: national + local, national, local }
}

export function simulate(input: SimulatorInput): SimulationResult {
  const salesTax = taxPortion(input.sales10Yen, RATE_STANDARD) + taxPortion(input.sales8Yen, RATE_REDUCED)
  const normalPurchaseTax =
    taxPortion(input.purchases10Yen, RATE_STANDARD) + taxPortion(input.purchases8Yen, RATE_REDUCED)
  const exemptPurchaseTax = Math.floor(
    (taxPortion(input.exemptPurchasesYen, RATE_STANDARD) * input.transitionalRatio) / 100,
  )
  const purchaseTax = normalPurchaseTax + exemptPurchaseTax

  const specialRate = SPECIAL_RATE_PERCENT[input.taxYear]
  const specialLabel = SPECIAL_LABEL[input.taxYear]
  const deemed = DEEMED_PURCHASE_RATE[input.businessType]

  const specialEligible = input.registered && input.baseSalesYen <= SPECIAL_LIMIT_YEN
  const simplifiedEligible = input.baseSalesYen <= SIMPLIFIED_LIMIT_YEN

  const specialNote = !input.registered
    ? 'インボイス発行事業者の登録がないため適用できません。'
    : input.baseSalesYen > SPECIAL_LIMIT_YEN
      ? '基準期間の課税売上高が1,000万円を超えるため適用できません。'
      : `売上税額の${specialRate}%を納付。仕入の集計は不要です（個人事業者のみ・要件は国税庁で要確認）。`

  const simplifiedNote = !simplifiedEligible
    ? '基準期間の課税売上高が5,000万円を超えるため適用できません。'
    : `みなし仕入率${deemed}%。適用には事前の「簡易課税制度選択届出書」の提出が必要です。`

  const method = (
    id: MethodId,
    label: string,
    eligible: boolean,
    amount: number,
    note: string,
  ): MethodResult => {
    const s = splitAndRound(amount)
    return { id, label, eligible, totalYen: s.total, nationalYen: s.national, localYen: s.local, note }
  }

  const methods: MethodResult[] = [
    method('special', specialLabel, specialEligible, Math.floor((salesTax * specialRate) / 100), specialNote),
    method(
      'simplified',
      '簡易課税',
      simplifiedEligible,
      salesTax - Math.floor((salesTax * deemed) / 100),
      simplifiedNote,
    ),
    method(
      'general',
      '原則課税（本則課税）',
      true,
      salesTax - purchaseTax,
      '実際の課税仕入れを集計して控除します。マイナスは還付の目安です。',
    ),
    method(
      'exempt',
      '免税事業者のまま（参考）',
      input.baseSalesYen <= SPECIAL_LIMIT_YEN,
      0,
      '納税は不要ですが、インボイスを発行できないため取引先との条件に影響する場合があります。',
    ),
  ]

  const candidates = methods.filter((m) => m.id !== 'exempt' && m.eligible)
  let bestId: MethodId | null = null
  let bestAmount = Infinity
  for (const m of candidates) {
    if (m.totalYen < bestAmount) {
      bestAmount = m.totalYen
      bestId = m.id
    }
  }

  return { salesTaxYen: salesTax, purchaseTaxYen: purchaseTax, methods, bestId }
}
