import {
  BUSINESS_TYPES,
  SIMPLIFIED_BASE_SALES_LIMIT_YEN,
  SPECIAL_BASE_SALES_LIMIT_YEN,
  THREE_WARI_YEARS,
  TWO_WARI_YEARS,
  TAX_YEARS,
  type BusinessType,
  type TaxYear,
} from './rules'

export interface SimulatorInput {
  year: TaxYear
  /** 課税売上（標準税率10%・税込・円） */
  salesStandardYen: number
  /** 課税売上（軽減税率8%・税込・円） */
  salesReducedYen: number
  /** 課税仕入（標準税率10%・税込・円。適格請求書等の保存があるもの） */
  purchasesStandardYen: number
  /** 課税仕入（軽減税率8%・税込・円） */
  purchasesReducedYen: number
  businessType: BusinessType
  /** インボイス発行事業者の登録を機に免税事業者から課税事業者になったか */
  registeredToBecomeTaxable: boolean
  /** 基準期間（2年前）の課税売上高（税抜・円） */
  baseSalesYen: number
}

export type MethodId = 'standard' | 'simplified' | 'two-wari' | 'three-wari'

export interface MethodResult {
  id: MethodId
  label: string
  available: boolean
  /** 利用できない／要確認の理由 */
  note: string
  salesTaxYen: number
  deductionYen: number
  /** 納付税額（マイナスは還付）。利用不可でも参考値として計算する */
  payableYen: number
}

export interface SimulationResult {
  methods: MethodResult[]
  /** 利用可能な方式のうち納付税額が最小のもの */
  bestId: MethodId
  /** 利用可能な方式のうち最も有利な方式と本則課税との差額（正のとき本則より安い） */
  savingVsStandardYen: number
}

const toInt = (n: number) => Math.floor(n)

/** 税込額から消費税額（国税＋地方税の合計）を割り戻す。端数は切り捨て。 */
export function taxFromInclusive(amountYen: number, ratePercent: number): number {
  return toInt((amountYen * ratePercent) / (100 + ratePercent))
}

export function validateInput(input: SimulatorInput): string[] {
  const errors: string[] = []
  const money: [keyof SimulatorInput, string][] = [
    ['salesStandardYen', '課税売上（10%）'],
    ['salesReducedYen', '課税売上（8%）'],
    ['purchasesStandardYen', '課税仕入（10%）'],
    ['purchasesReducedYen', '課税仕入（8%）'],
    ['baseSalesYen', '基準期間の課税売上高'],
  ]
  for (const [key, label] of money) {
    const v = input[key] as number
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${label}は数値で入力してください。`)
    } else if (v < 0) {
      errors.push(`${label}は0以上で入力してください。`)
    } else if (v > 100_000_000_000) {
      errors.push(`${label}が大きすぎます（1,000億円以下で入力してください）。`)
    }
  }
  if (!(TAX_YEARS as readonly number[]).includes(input.year)) {
    errors.push('対象年は2026〜2028年から選んでください。')
  }
  if (!BUSINESS_TYPES.some((b) => b.id === input.businessType)) {
    errors.push('事業区分が不正です。')
  }
  return errors
}

export function simulate(input: SimulatorInput): SimulationResult {
  const salesTax =
    taxFromInclusive(input.salesStandardYen, 10) + taxFromInclusive(input.salesReducedYen, 8)
  const purchaseTax =
    taxFromInclusive(input.purchasesStandardYen, 10) + taxFromInclusive(input.purchasesReducedYen, 8)

  const deemed = BUSINESS_TYPES.find((b) => b.id === input.businessType)!.deemedRate

  const standard: MethodResult = {
    id: 'standard',
    label: '本則課税（実額の仕入税額控除）',
    available: true,
    note: '',
    salesTaxYen: salesTax,
    deductionYen: purchaseTax,
    payableYen: salesTax - purchaseTax,
  }

  const simplifiedDeduction = toInt((salesTax * deemed) / 100)
  const simplifiedOk = input.baseSalesYen <= SIMPLIFIED_BASE_SALES_LIMIT_YEN
  const simplified: MethodResult = {
    id: 'simplified',
    label: `簡易課税（みなし仕入率${deemed}%）`,
    available: simplifiedOk,
    note: simplifiedOk
      ? '「消費税簡易課税制度選択届出書」の事前提出が必要です（適用を始める年の前年12月31日まで）。'
      : '基準期間の課税売上高が5,000万円を超えるため選択できません。',
    salesTaxYen: salesTax,
    deductionYen: simplifiedDeduction,
    payableYen: salesTax - simplifiedDeduction,
  }

  const specialBaseOk = input.baseSalesYen <= SPECIAL_BASE_SALES_LIMIT_YEN
  const twoDeduction = toInt(salesTax * 0.8)
  const twoYearOk = TWO_WARI_YEARS.includes(input.year)
  const twoWari: MethodResult = {
    id: 'two-wari',
    label: '2割特例（納付税額＝売上税額の20%）',
    available: twoYearOk && input.registeredToBecomeTaxable && specialBaseOk,
    note: !twoYearOk
      ? '2割特例は2026年分までの措置です。'
      : !input.registeredToBecomeTaxable
        ? 'インボイス登録を機に課税事業者になった方が対象です。'
        : !specialBaseOk
          ? '基準期間の課税売上高が1,000万円を超えるため対象外です。'
          : '届出は不要で、確定申告書に適用を受ける旨を記載します。',
    salesTaxYen: salesTax,
    deductionYen: twoDeduction,
    payableYen: salesTax - twoDeduction,
  }

  const threeDeduction = toInt(salesTax * 0.7)
  const threeYearOk = THREE_WARI_YEARS.includes(input.year)
  const threeWari: MethodResult = {
    id: 'three-wari',
    label: '3割特例（納付税額＝売上税額の30%）',
    available: threeYearOk && input.registeredToBecomeTaxable && specialBaseOk,
    note: !threeYearOk
      ? '3割特例は2027〜2028年分（個人事業者のみ）の措置です。'
      : !input.registeredToBecomeTaxable
        ? 'インボイス登録を機に課税事業者になった個人事業者が対象です。'
        : !specialBaseOk
          ? '基準期間の課税売上高が1,000万円を超えるため対象外の可能性があります（要確認）。'
          : '個人事業者のみ。届出は不要で、確定申告書に適用を受ける旨を記載します。対象要件は最新の公表資料で必ず確認してください。',
    salesTaxYen: salesTax,
    deductionYen: threeDeduction,
    payableYen: salesTax - threeDeduction,
  }

  const methods = [standard, simplified, twoWari, threeWari]
  const usable = methods.filter((m) => m.available)
  const best = usable.reduce((a, b) => (b.payableYen < a.payableYen ? b : a))
  return {
    methods,
    bestId: best.id,
    savingVsStandardYen: standard.payableYen - best.payableYen,
  }
}

/** 全角数字・カンマ・「円」を許容して整数に変換する。空文字は0。変換不能はNaN。 */
export function parseYen(text: string): number {
  const half = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,、\s円￥¥]/g, '')
    .replace(/[－−ー]/g, '-')
  if (half === '') return 0
  if (!/^-?\d+$/.test(half)) return NaN
  return Number(half)
}
