import {
  INCOME_TAX_BASIC_DEDUCTION,
  INCOME_TAX_BRACKETS,
  LIMIT_RATIO_OF_RESIDENT_TAX,
  MAX_SALARY_YEN,
  PERSONAL,
  RECONSTRUCTION_FACTOR,
  RESIDENT_BASIC_DEDUCTION,
  SAFETY_MARGIN,
  SALARY_DEDUCTION_TABLE,
  SELF_BURDEN_YEN,
  SOCIAL_INSURANCE_DEFAULT_RATE,
  SPECIAL_DEDUCTION_BASE,
  SPOUSE_RESIDENT_TIERS,
} from './params'

export type SpouseType = 'none' | 'spouse' | 'special'

export interface SimulatorInput {
  salaryYen: number
  /** null のとき給与収入の15%で概算 */
  socialInsuranceYen: number | null
  spouse: SpouseType
  dependentsGeneral: number
  dependentsSpecific: number
  dependentsElderly: number
  otherDeductionsYen: number
  housingLoanResidentTaxYen: number
  plannedDonationYen: number
}

export interface SimulationResult {
  salaryDeductionYen: number
  incomeYen: number
  socialInsuranceYen: number
  residentTaxableYen: number
  incomeTaxableYen: number
  incomeTaxRate: number
  adjustmentDeductionYen: number
  residentTaxIncomePortionYen: number
  specialDeductionRate: number
  limitYen: number
  safeLimitYen: number
  donationStatus: 'none' | 'within' | 'over'
  estimatedSelfBurdenYen: number
}

export const DEFAULT_INPUT: SimulatorInput = {
  salaryYen: 5_000_000,
  socialInsuranceYen: null,
  spouse: 'none',
  dependentsGeneral: 0,
  dependentsSpecific: 0,
  dependentsElderly: 0,
  otherDeductionsYen: 0,
  housingLoanResidentTaxYen: 0,
  plannedDonationYen: 0,
}

const floorTo = (value: number, unit: number) => Math.floor(value / unit) * unit

export function salaryDeduction(salaryYen: number): number {
  for (const row of SALARY_DEDUCTION_TABLE) {
    if (salaryYen <= row.upTo) {
      return Math.floor(salaryYen * row.rate + row.add)
    }
  }
  return 0
}

function pick<T extends { upTo: number }>(table: ReadonlyArray<T>, value: number): T {
  return table.find((row) => value <= row.upTo) ?? table[table.length - 1]
}

export function incomeTaxRateFor(taxableYen: number): number {
  return pick(INCOME_TAX_BRACKETS, taxableYen).rate
}

export function sanitizeInput(input: SimulatorInput): SimulatorInput {
  const num = (v: number, max: number) => (Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), 0), max) : 0)
  return {
    salaryYen: num(input.salaryYen, MAX_SALARY_YEN),
    socialInsuranceYen: input.socialInsuranceYen === null ? null : num(input.socialInsuranceYen, MAX_SALARY_YEN),
    spouse: input.spouse === 'spouse' || input.spouse === 'special' ? input.spouse : 'none',
    dependentsGeneral: num(input.dependentsGeneral, 20),
    dependentsSpecific: num(input.dependentsSpecific, 20),
    dependentsElderly: num(input.dependentsElderly, 20),
    otherDeductionsYen: num(input.otherDeductionsYen, MAX_SALARY_YEN),
    housingLoanResidentTaxYen: num(input.housingLoanResidentTaxYen, MAX_SALARY_YEN),
    plannedDonationYen: num(input.plannedDonationYen, MAX_SALARY_YEN),
  }
}

export function simulate(raw: SimulatorInput): SimulationResult {
  const input = sanitizeInput(raw)
  const salary = input.salaryYen
  const salaryDed = Math.min(salaryDeduction(salary), salary)
  const income = Math.max(salary - salaryDed, 0)
  const social =
    input.socialInsuranceYen === null
      ? Math.floor(salary * SOCIAL_INSURANCE_DEFAULT_RATE)
      : input.socialInsuranceYen

  // 人的控除（住民税側・所得税側）
  const spouseRatio = pick(SPOUSE_RESIDENT_TIERS, income).ratio
  const spouseOn = input.spouse !== 'none'
  const spouseResident = spouseOn ? Math.floor(PERSONAL.spouse.resident * spouseRatio) : 0
  const spouseIncome = spouseOn ? Math.floor(PERSONAL.spouse.income * spouseRatio) : 0
  const g = input.dependentsGeneral
  const s = input.dependentsSpecific
  const e = input.dependentsElderly
  const depResident =
    g * PERSONAL.dependentGeneral.resident + s * PERSONAL.dependentSpecific.resident + e * PERSONAL.dependentElderly.resident
  const depIncome =
    g * PERSONAL.dependentGeneral.income + s * PERSONAL.dependentSpecific.income + e * PERSONAL.dependentElderly.income

  const residentBasic = pick(RESIDENT_BASIC_DEDUCTION, income).amount
  const incomeBasic = pick(INCOME_TAX_BASIC_DEDUCTION, income).amount

  const residentTaxable = floorTo(
    Math.max(income - social - input.otherDeductionsYen - residentBasic - spouseResident - depResident, 0),
    1000,
  )
  const incomeTaxable = floorTo(
    Math.max(income - social - input.otherDeductionsYen - incomeBasic - spouseIncome - depIncome, 0),
    1000,
  )
  const incomeTaxRate = incomeTaxRateFor(incomeTaxable)

  // 調整控除（人的控除額の差 × 5%）
  const personalDiff =
    (income <= 25_000_000 ? PERSONAL.basicDiff : 0) +
    (spouseOn ? Math.floor((PERSONAL.spouse.income - PERSONAL.spouse.resident) * spouseRatio) : 0) +
    g * (PERSONAL.dependentGeneral.income - PERSONAL.dependentGeneral.resident) +
    s * (PERSONAL.dependentSpecific.income - PERSONAL.dependentSpecific.resident) +
    e * (PERSONAL.dependentElderly.income - PERSONAL.dependentElderly.resident)
  let adjustment = 0
  if (income <= 25_000_000 && residentTaxable > 0) {
    if (residentTaxable <= 2_000_000) {
      adjustment = Math.floor(Math.min(personalDiff, residentTaxable) * 0.05)
    } else {
      adjustment = Math.max(Math.floor((personalDiff - (residentTaxable - 2_000_000)) * 0.05), 2_500)
    }
  }

  const residentPortion = Math.max(
    Math.floor(residentTaxable * 0.1) - adjustment - input.housingLoanResidentTaxYen,
    0,
  )

  const specialRate = SPECIAL_DEDUCTION_BASE - incomeTaxRate * RECONSTRUCTION_FACTOR
  let limit = 0
  if (residentPortion > 0 && specialRate > 0) {
    limit = Math.floor((residentPortion * LIMIT_RATIO_OF_RESIDENT_TAX) / specialRate) + SELF_BURDEN_YEN
  }
  limit = floorTo(limit, 100)
  const safeLimit = limit > SELF_BURDEN_YEN ? Math.max(floorTo(limit * SAFETY_MARGIN, 1000), SELF_BURDEN_YEN) : limit

  let donationStatus: SimulationResult['donationStatus'] = 'none'
  let selfBurden = 0
  if (input.plannedDonationYen > 0) {
    if (input.plannedDonationYen <= limit) {
      donationStatus = 'within'
      selfBurden = SELF_BURDEN_YEN
    } else {
      donationStatus = 'over'
      selfBurden = SELF_BURDEN_YEN + (input.plannedDonationYen - limit)
    }
  }

  return {
    salaryDeductionYen: salaryDed,
    incomeYen: income,
    socialInsuranceYen: social,
    residentTaxableYen: residentTaxable,
    incomeTaxableYen: incomeTaxable,
    incomeTaxRate,
    adjustmentDeductionYen: adjustment,
    residentTaxIncomePortionYen: residentPortion,
    specialDeductionRate: specialRate,
    limitYen: limit,
    safeLimitYen: safeLimit,
    donationStatus,
    estimatedSelfBurdenYen: selfBurden,
  }
}

export const TABLE_SALARIES_MAN = [300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000]

/** 現在の家族構成を保ったまま、給与収入だけを変えた早見表。 */
export function buildQuickTable(input: SimulatorInput): Array<{ salaryYen: number; limitYen: number; safeLimitYen: number }> {
  return TABLE_SALARIES_MAN.map((man) => {
    const salaryYen = man * 10_000
    const r = simulate({ ...input, salaryYen, socialInsuranceYen: null, plannedDonationYen: 0 })
    return { salaryYen, limitYen: r.limitYen, safeLimitYen: r.safeLimitYen }
  })
}

/** 全角数字・カンマ・「円」等を許容して整数にする。解釈できなければ null。 */
export function parseYen(text: string): number | null {
  const normalized = text.normalize('NFKC').replace(/[,\s円]/g, '')
  if (normalized === '') return null
  if (!/^\d+$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isSafeInteger(n) ? n : null
}
