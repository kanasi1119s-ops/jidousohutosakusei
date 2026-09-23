/**
 * ふるさと納税 控除上限額の概算計算ロジック。
 *
 * すべてブラウザ内で計算し、外部には一切送信しない。
 *
 * 出典（考え方の根拠）:
 * - 総務省 ふるさと納税のしくみ｜税金の控除について
 *   https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html
 * - 控除上限額の式: 住民税所得割額 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000円
 *
 * 本ツールは給与所得者を対象とした簡易モデルであり、実際の税額は
 * 医療費控除・iDeCo・生命保険料控除・調整控除などにより変動する。
 * あくまで概算であり、正確な金額は自治体・税理士等に確認すること。
 */

export type FamilyType =
  | 'single' // 独身 または夫婦(配偶者に収入あり)
  | 'spouse_no_income' // 夫婦(配偶者に収入なし、配偶者控除あり)
  | 'spouse_no_income_child1_hs' // 夫婦+子1人(高校生)
  | 'spouse_no_income_child1_univ' // 夫婦+子1人(大学生)
  | 'spouse_no_income_child2_hs_univ' // 夫婦+子2人(高校生+大学生)

export interface SimulationInput {
  /** 年収(給与収入額)。単位: 円 */
  annualIncome: number
  familyType: FamilyType
}

export interface SimulationResult {
  /** ふるさと納税の年間控除上限額(概算)。単位: 円、100円未満切り捨て */
  donationLimit: number
  /** 給与所得(給与所得控除後)。単位: 円 */
  employmentIncome: number
  /** 所得税の課税所得。単位: 円 */
  taxableIncomeNational: number
  /** 住民税の課税所得。単位: 円 */
  taxableIncomeLocal: number
  /** 所得税率(復興特別所得税を含まない基準税率) */
  nationalTaxRate: number
  /** 住民税所得割額。単位: 円 */
  localIncomeLeviedTax: number
}

const RECONSTRUCTION_SURTAX_RATE = 1.021
const LOCAL_TAX_SPECIAL_PORTION_BASE = 0.9 // 100% - 住民税基本分10%
const LOCAL_TAX_LIMIT_RATIO = 0.2 // 住民税所得割額に対する上限比率20%
const SELF_BURDEN_YEN = 2000

/** 家族構成ごとの所得税控除額・住民税控除額(円) */
const FAMILY_DEDUCTIONS: Record<FamilyType, { national: number; local: number }> = {
  single: { national: 0, local: 0 },
  spouse_no_income: { national: 380000, local: 330000 },
  spouse_no_income_child1_hs: { national: 380000 + 380000, local: 330000 + 330000 },
  spouse_no_income_child1_univ: { national: 380000 + 630000, local: 330000 + 450000 },
  spouse_no_income_child2_hs_univ: {
    national: 380000 + 380000 + 630000,
    local: 330000 + 330000 + 450000,
  },
}

export const FAMILY_TYPE_LABELS: Record<FamilyType, string> = {
  single: '独身、または配偶者に収入がある夫婦',
  spouse_no_income: '夫婦（配偶者に収入なし・子なし）',
  spouse_no_income_child1_hs: '夫婦＋子1人（高校生）',
  spouse_no_income_child1_univ: '夫婦＋子1人（大学生）',
  spouse_no_income_child2_hs_univ: '夫婦＋子2人（高校生・大学生）',
}

/** 給与所得控除（2020年以降の制度、令和8年時点でも同じ表を使用） */
export function calcEmploymentIncomeDeduction(income: number): number {
  if (income <= 0) return 0
  if (income <= 1625000) return 550000
  if (income <= 1800000) return Math.round(income * 0.4 - 100000)
  if (income <= 3600000) return Math.round(income * 0.3 + 80000)
  if (income <= 6600000) return Math.round(income * 0.2 + 440000)
  if (income <= 8500000) return Math.round(income * 0.1 + 1100000)
  return 1950000
}

/** 社会保険料控除の概算（年収の15%と仮定する簡易モデル） */
export function estimateSocialInsuranceDeduction(income: number): number {
  return Math.round(income * 0.15)
}

const NATIONAL_BASIC_DEDUCTION = 480000
const LOCAL_BASIC_DEDUCTION = 430000

/** 所得税の超過累進税率（基準所得税額に対する税率）を課税所得から求める */
export function findNationalTaxRate(taxableIncome: number): number {
  if (taxableIncome <= 1950000) return 0.05
  if (taxableIncome <= 3300000) return 0.1
  if (taxableIncome <= 6950000) return 0.2
  if (taxableIncome <= 9000000) return 0.23
  if (taxableIncome <= 18000000) return 0.33
  if (taxableIncome <= 40000000) return 0.4
  return 0.45
}

function clampToZero(value: number): number {
  return value < 0 ? 0 : value
}

export function simulate(input: SimulationInput): SimulationResult {
  const { annualIncome, familyType } = input
  const deductions = FAMILY_DEDUCTIONS[familyType]

  const employmentIncome = clampToZero(annualIncome - calcEmploymentIncomeDeduction(annualIncome))
  const socialInsurance = estimateSocialInsuranceDeduction(annualIncome)

  const taxableIncomeNational = clampToZero(
    employmentIncome - socialInsurance - NATIONAL_BASIC_DEDUCTION - deductions.national,
  )
  const taxableIncomeLocal = clampToZero(
    employmentIncome - socialInsurance - LOCAL_BASIC_DEDUCTION - deductions.local,
  )

  // 課税所得は1,000円未満切り捨て
  const taxableIncomeNationalRounded = Math.floor(taxableIncomeNational / 1000) * 1000
  const taxableIncomeLocalRounded = Math.floor(taxableIncomeLocal / 1000) * 1000

  const nationalTaxRate = findNationalTaxRate(taxableIncomeNationalRounded)
  const localIncomeLeviedTax = Math.floor(taxableIncomeLocalRounded * 0.1)

  const denominator = LOCAL_TAX_SPECIAL_PORTION_BASE - nationalTaxRate * RECONSTRUCTION_SURTAX_RATE
  // 住民税所得割額が0円の場合は控除対象額そのものが無いため、上限額も0円とする
  // (常に自己負担2,000円分だけを加算してしまうと無所得でも上限が出る不具合になる)
  const rawLimit =
    denominator > 0 && localIncomeLeviedTax > 0
      ? (localIncomeLeviedTax * LOCAL_TAX_LIMIT_RATIO) / denominator + SELF_BURDEN_YEN
      : 0

  const donationLimit = Math.floor(clampToZero(rawLimit) / 100) * 100

  return {
    donationLimit,
    employmentIncome,
    taxableIncomeNational: taxableIncomeNationalRounded,
    taxableIncomeLocal: taxableIncomeLocalRounded,
    nationalTaxRate,
    localIncomeLeviedTax,
  }
}
