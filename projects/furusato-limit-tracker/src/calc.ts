import {
  RESIDENT_BASIC_DEDUCTION,
  incomeTaxBasicDeduction,
  marginalIncomeTaxRate,
  salaryIncomeDeduction,
  spouseFactor,
} from './params'

export interface LimitInput {
  salaryYen: number
  /** 社会保険料の概算率（給与収入に対する割合）。socialInsuranceYen が指定されればそちらを優先 */
  socialInsuranceRate: number
  socialInsuranceYen: number | null
  hasSpouse: boolean
  generalDependents: number // 16-18歳・23-69歳
  specificDependents: number // 19-22歳
  elderlyDependents: number // 70歳以上
  otherDeductionYen: number // 医療費控除・生命保険料控除等の合計
}

export interface LimitResult {
  salaryIncomeYen: number
  incomeTaxTaxableYen: number
  residentTaxableYen: number
  marginalRate: number
  residentTaxAmountYen: number
  limitYen: number // 1,000円未満切り捨て
  safeLimitYen: number // limitYen の90％（1,000円未満切り捨て）
}

export function validateLimitInput(i: LimitInput): string[] {
  const errors: string[] = []
  const nonNeg: [string, number][] = [
    ['給与収入', i.salaryYen],
    ['社会保険料率', i.socialInsuranceRate],
    ['その他の控除額', i.otherDeductionYen],
    ['一般の扶養親族', i.generalDependents],
    ['特定扶養親族', i.specificDependents],
    ['老人扶養親族', i.elderlyDependents],
  ]
  for (const [name, v] of nonNeg) {
    if (!Number.isFinite(v) || v < 0) errors.push(`${name}は0以上の数値で入力してください。`)
  }
  if (i.socialInsuranceYen !== null && (!Number.isFinite(i.socialInsuranceYen) || i.socialInsuranceYen < 0)) {
    errors.push('社会保険料（実額）は0以上の数値で入力してください。')
  }
  if (i.socialInsuranceRate > 0.3) errors.push('社会保険料率は30％以下で入力してください。')
  if (i.salaryYen > 1_000_000_000) errors.push('給与収入が大きすぎます（10億円以下）。')
  for (const [name, v] of [
    ['一般の扶養親族', i.generalDependents],
    ['特定扶養親族', i.specificDependents],
    ['老人扶養親族', i.elderlyDependents],
  ] as [string, number][]) {
    if (Number.isFinite(v) && !Number.isInteger(v)) errors.push(`${name}は整数で入力してください。`)
    if (v > 20) errors.push(`${name}は20人以下で入力してください。`)
  }
  return errors
}

const floorTo = (v: number, unit: number) => Math.floor(v / unit) * unit

export function calcLimit(i: LimitInput): LimitResult {
  const salary = Math.max(0, i.salaryYen)
  const salaryIncome = Math.max(0, salary - salaryIncomeDeduction(salary))
  const si = i.socialInsuranceYen ?? salary * i.socialInsuranceRate
  const sf = i.hasSpouse ? spouseFactor(salaryIncome) : 0

  // 人的控除（所得税 / 住民税）
  const taxPersonal =
    incomeTaxBasicDeduction(salaryIncome) +
    380_000 * sf +
    380_000 * i.generalDependents +
    630_000 * i.specificDependents +
    480_000 * i.elderlyDependents
  const resPersonal =
    (salaryIncome <= 24_000_000 ? RESIDENT_BASIC_DEDUCTION : 0) +
    330_000 * sf +
    330_000 * i.generalDependents +
    450_000 * i.specificDependents +
    380_000 * i.elderlyDependents

  const incomeTaxTaxable = floorTo(Math.max(0, salaryIncome - si - taxPersonal - i.otherDeductionYen), 1000)
  const residentTaxable = floorTo(Math.max(0, salaryIncome - si - resPersonal - i.otherDeductionYen), 1000)
  const marginalRate = marginalIncomeTaxRate(incomeTaxTaxable)

  // 調整控除（人的控除額の差 × 5％。基礎控除差は5万円で固定の概算）
  let adjustment = 0
  if (salaryIncome <= 25_000_000 && residentTaxable > 0) {
    const diff =
      50_000 + 50_000 * sf + 50_000 * i.generalDependents + 180_000 * i.specificDependents + 100_000 * i.elderlyDependents
    if (residentTaxable <= 2_000_000) adjustment = Math.min(diff, residentTaxable) * 0.05
    else adjustment = Math.max((diff - (residentTaxable - 2_000_000)) * 0.05, 2_500)
  }
  const residentTaxAmount = Math.max(0, Math.floor(residentTaxable * 0.1 - adjustment))

  let limit = 0
  if (residentTaxAmount > 0) {
    limit = (residentTaxAmount * 0.2) / (0.9 - marginalRate * 1.021) + 2000
  }
  const limitYen = floorTo(Math.max(0, limit), 1000)
  return {
    salaryIncomeYen: Math.round(salaryIncome),
    incomeTaxTaxableYen: incomeTaxTaxable,
    residentTaxableYen: residentTaxable,
    marginalRate,
    residentTaxAmountYen: residentTaxAmount,
    limitYen,
    safeLimitYen: floorTo(limitYen * 0.9, 1000),
  }
}
