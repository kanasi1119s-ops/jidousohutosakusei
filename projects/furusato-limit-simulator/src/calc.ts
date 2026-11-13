import {
  INCOME_TAX_BRACKETS,
  RECONSTRUCTION_MULTIPLIER,
  RESIDENT_TAX_RATE,
  SALARY_DEDUCTION_MIN_INCOME_TAX,
  SALARY_DEDUCTION_MIN_LIMIT_INCOME_TAX,
  SALARY_DEDUCTION_MIN_RESIDENT_TAX,
  SELF_PAYMENT_YEN,
  SOCIAL_INSURANCE_ESTIMATE_RATE,
} from './params'

export type SpouseType = 'none' | 'general' | 'elderly'

export interface LimitInput {
  /** 給与収入（年額・円） */
  salaryYen: number
  /** 社会保険料の実額を使うか（false なら概算率で自動計算） */
  useActualSocialInsurance: boolean
  /** 社会保険料（年額・円）。useActualSocialInsurance=true のとき使用 */
  socialInsuranceYen: number
  spouse: SpouseType
  /** 一般の扶養親族（16〜18歳・23〜69歳）の人数 */
  dependentsGeneral: number
  /** 特定扶養親族（19〜22歳）の人数 */
  dependentsSpecific: number
  /** 老人扶養親族（70歳以上）の人数 */
  dependentsElderly: number
  /** 生命保険料控除・iDeCo・地震保険料控除・医療費控除などの合計額（所得税・住民税で同額とみなす） */
  otherDeductionsYen: number
  /** 住民税から控除される住宅ローン控除額（年額・円） */
  housingLoanResidentCreditYen: number
}

export interface LimitResult {
  salaryIncomeIncomeTaxYen: number
  salaryIncomeResidentTaxYen: number
  socialInsuranceYen: number
  incomeTaxTaxableYen: number
  residentTaxTaxableYen: number
  incomeTaxRate: number
  residentTaxBeforeAdjustYen: number
  adjustmentCreditYen: number
  residentTaxIncomePortionYen: number
  /** 控除上限額の目安（1,000円未満切り捨て） */
  limitYen: number
  /** 余裕を見た目安（上限額の90%、1,000円未満切り捨て） */
  safeLimitYen: number
}

export function salaryDeduction(salaryYen: number, kind: 'incomeTax' | 'residentTax'): number {
  const min = kind === 'incomeTax' ? SALARY_DEDUCTION_MIN_INCOME_TAX : SALARY_DEDUCTION_MIN_RESIDENT_TAX
  const minLimit = kind === 'incomeTax' ? SALARY_DEDUCTION_MIN_LIMIT_INCOME_TAX : 1_625_000
  if (salaryYen <= minLimit) return Math.min(min, salaryYen)
  if (salaryYen <= 1_800_000) return Math.max(min, Math.floor(salaryYen * 0.4) - 100_000)
  if (salaryYen <= 3_600_000) return Math.max(min, Math.floor(salaryYen * 0.3) + 80_000)
  if (salaryYen <= 6_600_000) return Math.floor(salaryYen * 0.2) + 440_000
  if (salaryYen <= 8_500_000) return Math.floor(salaryYen * 0.1) + 1_100_000
  return 1_950_000
}

export function basicDeductionIncomeTax(totalIncomeYen: number): number {
  if (totalIncomeYen <= 4_890_000) return 1_040_000
  if (totalIncomeYen <= 6_550_000) return 670_000
  if (totalIncomeYen <= 23_500_000) return 620_000
  if (totalIncomeYen <= 24_000_000) return 480_000
  if (totalIncomeYen <= 24_500_000) return 320_000
  if (totalIncomeYen <= 25_000_000) return 160_000
  return 0
}

export function basicDeductionResidentTax(totalIncomeYen: number): number {
  if (totalIncomeYen <= 24_000_000) return 430_000
  if (totalIncomeYen <= 24_500_000) return 290_000
  if (totalIncomeYen <= 25_000_000) return 150_000
  return 0
}

export function incomeTaxRate(taxableYen: number): number {
  for (const [upper, rate] of INCOME_TAX_BRACKETS) {
    if (taxableYen <= upper) return rate
  }
  return 0.45
}

function floorThousand(n: number): number {
  return Math.floor(Math.max(0, n) / 1000) * 1000
}

/** 本人の合計所得に応じた配偶者控除の逓減係数（900万円以下:1、950万円以下:2/3、1,000万円以下:1/3、超:0） */
function spouseFactor(totalIncomeYen: number): number {
  if (totalIncomeYen <= 9_000_000) return 1
  if (totalIncomeYen <= 9_500_000) return 2 / 3
  if (totalIncomeYen <= 10_000_000) return 1 / 3
  return 0
}

export function validateInput(input: LimitInput): string[] {
  const errors: string[] = []
  const nums: Array<[string, number]> = [
    ['給与収入', input.salaryYen],
    ['社会保険料', input.socialInsuranceYen],
    ['扶養親族（一般）', input.dependentsGeneral],
    ['扶養親族（特定）', input.dependentsSpecific],
    ['扶養親族（老人）', input.dependentsElderly],
    ['その他の所得控除', input.otherDeductionsYen],
    ['住宅ローン控除（住民税）', input.housingLoanResidentCreditYen],
  ]
  for (const [label, v] of nums) {
    if (!Number.isFinite(v) || v < 0) errors.push(`${label}は0以上の数値で入力してください。`)
  }
  if (Number.isFinite(input.salaryYen) && input.salaryYen > 100_000_000) {
    errors.push('給与収入は1億円以下で入力してください。')
  }
  for (const [label, v] of nums.slice(2, 5)) {
    if (Number.isFinite(v) && !Number.isInteger(v)) errors.push(`${label}は整数で入力してください。`)
  }
  return errors
}

export function calculateLimit(input: LimitInput): LimitResult {
  const salary = Math.floor(input.salaryYen)
  const socialInsurance = input.useActualSocialInsurance
    ? Math.floor(input.socialInsuranceYen)
    : Math.floor(salary * SOCIAL_INSURANCE_ESTIMATE_RATE)

  const incomeI = Math.max(0, salary - salaryDeduction(salary, 'incomeTax'))
  const incomeR = Math.max(0, salary - salaryDeduction(salary, 'residentTax'))

  const f = spouseFactor(incomeR)
  const spouseI = Math.floor((input.spouse === 'elderly' ? 480_000 : input.spouse === 'general' ? 380_000 : 0) * f)
  const spouseR = Math.floor((input.spouse === 'elderly' ? 380_000 : input.spouse === 'general' ? 330_000 : 0) * f)
  const depI = input.dependentsGeneral * 380_000 + input.dependentsSpecific * 630_000 + input.dependentsElderly * 480_000
  const depR = input.dependentsGeneral * 330_000 + input.dependentsSpecific * 450_000 + input.dependentsElderly * 380_000

  const taxableI = floorThousand(
    incomeI - socialInsurance - basicDeductionIncomeTax(incomeI) - spouseI - depI - input.otherDeductionsYen,
  )
  const taxableR = floorThousand(
    incomeR - socialInsurance - basicDeductionResidentTax(incomeR) - spouseR - depR - input.otherDeductionsYen,
  )

  const before = Math.floor(taxableR * RESIDENT_TAX_RATE)

  // 調整控除（人的控除額の差の合計に5%）
  const spouseDiff = input.spouse === 'elderly' ? 100_000 : input.spouse === 'general' ? 50_000 : 0
  const diff =
    50_000 +
    Math.floor(spouseDiff * f) +
    input.dependentsGeneral * 50_000 +
    input.dependentsSpecific * 180_000 +
    input.dependentsElderly * 100_000
  let adjust = 0
  if (taxableR > 0) {
    adjust =
      taxableR <= 2_000_000
        ? Math.floor(Math.min(diff, taxableR) * 0.05)
        : Math.floor(Math.max(diff - (taxableR - 2_000_000), 50_000) * 0.05)
  }

  const portion = Math.max(0, before - adjust - Math.floor(input.housingLoanResidentCreditYen))
  const rate = incomeTaxRate(taxableI)

  let limit = 0
  if (portion > 0) {
    const raw = (portion * 0.2) / (1 - RESIDENT_TAX_RATE - rate * RECONSTRUCTION_MULTIPLIER) + SELF_PAYMENT_YEN
    limit = floorThousand(raw)
  }
  return {
    salaryIncomeIncomeTaxYen: incomeI,
    salaryIncomeResidentTaxYen: incomeR,
    socialInsuranceYen: socialInsurance,
    incomeTaxTaxableYen: taxableI,
    residentTaxTaxableYen: taxableR,
    incomeTaxRate: rate,
    residentTaxBeforeAdjustYen: before,
    adjustmentCreditYen: adjust,
    residentTaxIncomePortionYen: portion,
    limitYen: limit,
    safeLimitYen: floorThousand(limit * 0.9),
  }
}
