export type MethodId = 'standard' | 'simplified' | 'special20' | 'special30'

export interface CompareInput {
  /** 対象年分（個人事業者の暦年）: 2026=令和8年分, 2027=令和9年分, 2028=令和10年分 */
  taxYear: number
  /** 免税事業者からインボイス発行事業者になったか（2割・3割特例の要件） */
  wasExempt: boolean
  /** 基準期間の課税売上高（円） */
  baseSalesYen: number
  /** 課税売上高・税率10%（税抜、円） */
  sales10Yen: number
  /** 課税売上高・軽減税率8%（税抜、円） */
  sales8Yen: number
  /** 課税仕入・税率10%（税込、インボイス発行事業者からの仕入、円） */
  purchases10Yen: number
  /** 課税仕入・軽減税率8%（税込、インボイス発行事業者からの仕入、円） */
  purchases8Yen: number
  /** 免税事業者等からの仕入・税率10%（税込、円） */
  exemptPurchases10Yen: number
  /** 免税事業者等からの仕入・軽減税率8%（税込、円） */
  exemptPurchases8Yen: number
  /** 免税事業者等からの仕入に適用する経過措置の控除割合（%） */
  exemptCreditPercent: number
  /** 簡易課税の事業区分（1〜6種） */
  simplifiedCategory: number
  /** 簡易課税制度選択届出書を提出済み（または提出予定で適用可）か */
  simplifiedFiled: boolean
}

export interface MethodResult {
  id: MethodId
  label: string
  eligible: boolean
  reason: string
  nationalYen: number
  localYen: number
  totalYen: number
  isRefund: boolean
}

export interface CompareResult {
  methods: MethodResult[]
  bestId: MethodId
  salesNationalYen: number
}

export const MAX_YEN = 4_999_999_999

export const METHOD_LABELS: Record<MethodId, string> = {
  standard: '本則課税',
  simplified: '簡易課税',
  special20: '2割特例',
  special30: '3割特例（令和9・10年分、税制改正大綱ベース）',
}

export const SIMPLIFIED_CATEGORIES: { value: number; label: string; ratio: number }[] = [
  { value: 1, label: '第1種（卸売業）90%', ratio: 90 },
  { value: 2, label: '第2種（小売業・農林水産業の飲食料品）80%', ratio: 80 },
  { value: 3, label: '第3種（製造業・建設業等）70%', ratio: 70 },
  { value: 4, label: '第4種（飲食店業・その他）60%', ratio: 60 },
  { value: 5, label: '第5種（サービス業・運輸通信業等）50%', ratio: 50 },
  { value: 6, label: '第6種（不動産業）40%', ratio: 40 },
]

export const TAX_YEARS: { value: number; label: string }[] = [
  { value: 2026, label: '令和8年分（2026年）' },
  { value: 2027, label: '令和9年分（2027年）' },
  { value: 2028, label: '令和10年分（2028年）' },
]

const floorTo = (value: number, unit: number): number => Math.floor(value / unit) * unit

/** 国税（7.8%・6.24%）ベースの売上に係る消費税額。課税標準額は税率ごとに千円未満切り捨て。 */
export function salesNationalTax(sales10Yen: number, sales8Yen: number): number {
  const base10 = floorTo(sales10Yen, 1000)
  const base8 = floorTo(sales8Yen, 1000)
  return Math.floor((base10 * 780 + base8 * 624) / 10000)
}

/** 税込の課税仕入に係る国税分（10%分: 78/110、8%分: 6.24/108）。 */
export function purchaseNationalTax(gross10Yen: number, gross8Yen: number): number {
  const num = gross10Yen * 78 * 10800 + gross8Yen * 624 * 1100
  return Math.floor(num / (1100 * 10800))
}

function localTax(nationalYen: number): number {
  return Math.floor((nationalYen * 22) / 78)
}

function finalize(nationalRaw: number): { national: number; local: number; refund: boolean } {
  if (nationalRaw < 0) {
    const refundNational = -nationalRaw
    return { national: refundNational, local: localTax(refundNational), refund: true }
  }
  const national = floorTo(nationalRaw, 100)
  return { national, local: floorTo(localTax(national), 100), refund: false }
}

export function validateInput(input: CompareInput): string[] {
  const errors: string[] = []
  const amountFields: [keyof CompareInput, string][] = [
    ['baseSalesYen', '基準期間の課税売上高'],
    ['sales10Yen', '課税売上高（10%）'],
    ['sales8Yen', '課税売上高（8%）'],
    ['purchases10Yen', '課税仕入（10%）'],
    ['purchases8Yen', '課税仕入（8%）'],
    ['exemptPurchases10Yen', '免税事業者等からの仕入（10%）'],
    ['exemptPurchases8Yen', '免税事業者等からの仕入（8%）'],
  ]
  for (const [key, label] of amountFields) {
    const v = input[key] as number
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${label}は数値で入力してください。`)
    } else if (v < 0) {
      errors.push(`${label}は0以上で入力してください。`)
    } else if (v > MAX_YEN) {
      errors.push(`${label}は${MAX_YEN.toLocaleString('ja-JP')}円以下で入力してください。`)
    }
  }
  const pct = input.exemptCreditPercent
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    errors.push('経過措置の控除割合は0〜100の数値で入力してください。')
  }
  if (!TAX_YEARS.some((y) => y.value === input.taxYear)) {
    errors.push('対象年分が不正です。')
  }
  if (!SIMPLIFIED_CATEGORIES.some((c) => c.value === input.simplifiedCategory)) {
    errors.push('簡易課税の事業区分が不正です。')
  }
  return errors
}

export function compare(input: CompareInput): CompareResult {
  const salesNat = salesNationalTax(input.sales10Yen, input.sales8Yen)

  const fullCredit = purchaseNationalTax(input.purchases10Yen, input.purchases8Yen)
  const exemptCreditFull = purchaseNationalTax(input.exemptPurchases10Yen, input.exemptPurchases8Yen)
  const exemptCredit = Math.floor((exemptCreditFull * input.exemptCreditPercent) / 100)
  const category = SIMPLIFIED_CATEGORIES.find((c) => c.value === input.simplifiedCategory)!

  const baseOk = input.baseSalesYen <= 10_000_000

  const build = (
    id: MethodId,
    eligible: boolean,
    reason: string,
    nationalRaw: number,
  ): MethodResult => {
    const f = finalize(nationalRaw)
    return {
      id,
      label: METHOD_LABELS[id],
      eligible,
      reason,
      nationalYen: f.national,
      localYen: f.local,
      totalYen: f.refund ? -(f.national + f.local) : f.national + f.local,
      isRefund: f.refund,
    }
  }

  const standard = build('standard', true, '', salesNat - fullCredit - exemptCredit)

  let simplifiedReason = ''
  if (input.baseSalesYen > 50_000_000) simplifiedReason = '基準期間の課税売上高が5,000万円を超えています。'
  else if (!input.simplifiedFiled) simplifiedReason = '簡易課税制度選択届出書の提出が必要です（要確認）。'
  const simplified = build(
    'simplified',
    simplifiedReason === '',
    simplifiedReason,
    Math.max(0, salesNat - Math.floor((salesNat * category.ratio) / 100)),
  )

  let s20Reason = ''
  if (input.taxYear !== 2026) s20Reason = '2割特例は令和8年分（2026年9月30日を含む課税期間）までです。'
  else if (!input.wasExempt) s20Reason = '免税事業者からインボイス発行事業者になった方のみ対象です。'
  else if (!baseOk) s20Reason = '基準期間の課税売上高が1,000万円を超えています。'
  const special20 = build('special20', s20Reason === '', s20Reason, Math.floor((salesNat * 20) / 100))

  let s30Reason = ''
  if (input.taxYear !== 2027 && input.taxYear !== 2028) s30Reason = '3割特例は令和9年分・令和10年分の個人事業者が対象です。'
  else if (!input.wasExempt) s30Reason = '免税事業者からインボイス発行事業者になった方のみ対象です。'
  else if (!baseOk) s30Reason = '基準期間の課税売上高が1,000万円を超えています。'
  const special30 = build('special30', s30Reason === '', s30Reason, Math.floor((salesNat * 30) / 100))

  const methods = [special20, special30, simplified, standard]
  const eligible = methods.filter((m) => m.eligible)
  // 同額の場合は適用要件の少ない方（配列の先頭側ではなく本則を最後に）を優先せず、先に出現した方を採用
  let best = eligible[0]
  for (const m of eligible) {
    if (m.totalYen < best.totalYen) best = m
  }
  return { methods, bestId: best.id, salesNationalYen: salesNat }
}
