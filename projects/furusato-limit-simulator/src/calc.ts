import {
  BASIC_DEDUCTION_INCOME_TAX,
  BASIC_DEDUCTION_RESIDENT,
  DEPENDENT_DEDUCTION,
  INCOME_TAX_BRACKETS,
  RECONSTRUCTION_SURTAX,
  SALARY_DEDUCTION_MIN,
  SELF_PAYMENT_YEN,
  SPECIAL_DEPENDENT_DEDUCTION,
  SPOUSE_DEDUCTION,
} from './rules'

export type SpouseType = 'none' | 'deduction'

export interface SimulatorInput {
  salaryYen: number
  /** 社会保険料等。null の場合は給与収入の15%で概算する */
  socialInsuranceYen: number | null
  spouse: SpouseType
  dependents: number
  specialDependents: number
}

export interface SimulationResult {
  salaryYen: number
  salaryDeductionYen: number
  incomeYen: number
  socialInsuranceYen: number
  incomeTaxableYen: number
  residentTaxableYen: number
  incomeTaxRate: number
  residentIncomeLevyYen: number
  adjustmentDeductionYen: number
  limitYen: number
  /** 返礼品の還元率30%以下という前提での受け取り額の参考値 */
  giftReferenceYen: number
}

export const DEFAULT_SOCIAL_INSURANCE_RATE = 0.15

export function salaryDeduction(salary: number): number {
  if (salary <= 0) return 0
  let d: number
  if (salary <= 1_900_000) d = SALARY_DEDUCTION_MIN
  else if (salary <= 3_600_000) d = salary * 0.3 + 80_000
  else if (salary <= 6_600_000) d = salary * 0.2 + 440_000
  else if (salary <= 8_500_000) d = salary * 0.1 + 1_100_000
  else d = 1_950_000
  return Math.min(Math.max(d, SALARY_DEDUCTION_MIN), salary)
}

function lookup(table: ReadonlyArray<readonly [number, number]>, income: number): number {
  for (const [upper, amount] of table) {
    if (income <= upper) return amount
  }
  return 0
}

export function incomeTaxRate(taxable: number): number {
  for (const [upper, rate] of INCOME_TAX_BRACKETS) {
    if (taxable <= upper) return rate
  }
  return 0.45
}

export function validateInput(input: SimulatorInput): string[] {
  const errors: string[] = []
  const finite = (v: number | null) => v === null || Number.isFinite(v)
  if (!Number.isFinite(input.salaryYen) || input.salaryYen < 0) {
    errors.push('給与収入は0以上の数値を入力してください。')
  } else if (input.salaryYen > 100_000_000) {
    errors.push('給与収入は1億円以下で入力してください。')
  }
  if (!finite(input.socialInsuranceYen) || (input.socialInsuranceYen ?? 0) < 0) {
    errors.push('社会保険料は0以上の数値を入力してください（空欄なら概算します）。')
  }
  for (const [label, v] of [
    ['一般の扶養親族', input.dependents],
    ['特定扶養親族', input.specialDependents],
  ] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 20) {
      errors.push(`${label}の人数は0〜20の整数で入力してください。`)
    }
  }
  return errors
}

export function simulate(input: SimulatorInput): SimulationResult {
  const salary = Math.floor(input.salaryYen)
  const salaryDed = Math.floor(salaryDeduction(salary))
  const income = Math.max(0, salary - salaryDed)
  const si = Math.min(
    income + salaryDed,
    Math.floor(input.socialInsuranceYen ?? salary * DEFAULT_SOCIAL_INSURANCE_RATE),
  )

  const spouseIT = input.spouse === 'deduction' ? SPOUSE_DEDUCTION.incomeTax : 0
  const spouseRes = input.spouse === 'deduction' ? SPOUSE_DEDUCTION.resident : 0
  const depIT =
    input.dependents * DEPENDENT_DEDUCTION.incomeTax +
    input.specialDependents * SPECIAL_DEPENDENT_DEDUCTION.incomeTax
  const depRes =
    input.dependents * DEPENDENT_DEDUCTION.resident +
    input.specialDependents * SPECIAL_DEPENDENT_DEDUCTION.resident

  const basicIT = lookup(BASIC_DEDUCTION_INCOME_TAX, income)
  const basicRes = lookup(BASIC_DEDUCTION_RESIDENT, income)

  const incomeTaxable = Math.max(0, income - si - basicIT - spouseIT - depIT)
  const residentTaxable = Math.max(0, income - si - basicRes - spouseRes - depRes)
  const rate = incomeTaxRate(incomeTaxable)

  // 調整控除: 所得税と住民税の人的控除額の差 × 5%
  const personalDiff =
    basicIT -
    basicRes +
    (spouseIT - spouseRes) +
    input.dependents * (DEPENDENT_DEDUCTION.incomeTax - DEPENDENT_DEDUCTION.resident) +
    input.specialDependents *
      (SPECIAL_DEPENDENT_DEDUCTION.incomeTax - SPECIAL_DEPENDENT_DEDUCTION.resident)
  const taxableRounded = Math.floor(residentTaxable / 1000) * 1000
  let adjustment: number
  if (taxableRounded <= 2_000_000) {
    adjustment = Math.min(personalDiff, taxableRounded) * 0.05
  } else {
    adjustment = Math.max(personalDiff - (taxableRounded - 2_000_000), 50_000) * 0.05
  }
  // 調整控除は合計所得金額2,500万円超では適用されない
  if (income > 25_000_000) adjustment = 0
  adjustment = Math.floor(adjustment)

  const levy = Math.max(0, Math.floor(taxableRounded * 0.1) - adjustment)

  let limit = 0
  if (levy > 0) {
    limit = Math.floor((levy * 0.2) / (0.9 - rate * RECONSTRUCTION_SURTAX) + SELF_PAYMENT_YEN)
    limit = Math.floor(limit / 100) * 100
  }

  return {
    salaryYen: salary,
    salaryDeductionYen: salaryDed,
    incomeYen: income,
    socialInsuranceYen: si,
    incomeTaxableYen: incomeTaxable,
    residentTaxableYen: residentTaxable,
    incomeTaxRate: rate,
    residentIncomeLevyYen: levy,
    adjustmentDeductionYen: adjustment,
    limitYen: limit,
    giftReferenceYen: Math.floor((limit * 0.3) / 100) * 100,
  }
}
