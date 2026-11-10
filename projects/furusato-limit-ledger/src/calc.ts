// ふるさと納税 控除上限額の目安計算（給与所得者・給与収入のみ・2025〜2026年分の制度を想定）
// 本計算は一般的な試算であり、実際の控除上限額を保証するものではありません。

export type SpouseType = 'none' | 'deduction'

export interface LimitInput {
  salaryYen: number
  /** null のときは給与収入の15%で概算 */
  socialInsuranceYen: number | null
  spouse: SpouseType
  /** 一般の控除対象扶養親族（16〜18歳・23〜69歳）の人数 */
  generalDependents: number
  /** 特定扶養親族（19〜22歳）の人数 */
  specialDependents: number
  /** 医療費控除・iDeCo等、所得税・住民税に共通する所得控除の合計 */
  otherDeductionYen: number
}

export interface LimitResult {
  salaryIncomeYen: number
  socialInsuranceYen: number
  incomeTaxableYen: number
  incomeTaxRate: number
  residentTaxableYen: number
  residentTaxIncomePortionYen: number
  adjustmentCreditYen: number
  limitYen: number
  warnings: string[]
}

export const SOCIAL_INSURANCE_AUTO_RATE = 0.15

export function salaryIncomeDeduction(salary: number): number {
  if (salary <= 1_900_000) return Math.min(salary, 650_000)
  if (salary <= 3_600_000) return salary * 0.3 + 80_000
  if (salary <= 6_600_000) return salary * 0.2 + 440_000
  if (salary <= 8_500_000) return salary * 0.1 + 1_100_000
  return 1_950_000
}

export function incomeTaxBasicDeduction(totalIncome: number): number {
  if (totalIncome <= 1_320_000) return 950_000
  if (totalIncome <= 3_360_000) return 880_000
  if (totalIncome <= 4_890_000) return 680_000
  if (totalIncome <= 6_550_000) return 630_000
  if (totalIncome <= 23_500_000) return 580_000
  if (totalIncome <= 24_000_000) return 480_000
  if (totalIncome <= 24_500_000) return 320_000
  if (totalIncome <= 25_000_000) return 160_000
  return 0
}

export function residentTaxBasicDeduction(totalIncome: number): number {
  if (totalIncome <= 24_000_000) return 430_000
  if (totalIncome <= 24_500_000) return 290_000
  if (totalIncome <= 25_000_000) return 150_000
  return 0
}

/** 配偶者控除額 [所得税, 住民税]（納税者本人の合計所得金額による。一般の控除対象配偶者のみ） */
export function spouseDeduction(totalIncome: number): [number, number] {
  if (totalIncome <= 9_000_000) return [380_000, 330_000]
  if (totalIncome <= 9_500_000) return [260_000, 220_000]
  if (totalIncome <= 10_000_000) return [130_000, 110_000]
  return [0, 0]
}

export function incomeTaxRate(taxable: number): number {
  if (taxable <= 1_950_000) return 0.05
  if (taxable <= 3_300_000) return 0.1
  if (taxable <= 6_950_000) return 0.2
  if (taxable <= 9_000_000) return 0.23
  if (taxable <= 18_000_000) return 0.33
  if (taxable <= 40_000_000) return 0.4
  return 0.45
}

const floor1000 = (n: number) => Math.floor(Math.max(n, 0) / 1000) * 1000

export function validateInput(i: LimitInput): string[] {
  const errors: string[] = []
  const nums: Array<[string, number | null]> = [
    ['給与収入', i.salaryYen],
    ['社会保険料', i.socialInsuranceYen],
    ['一般の扶養親族の人数', i.generalDependents],
    ['特定扶養親族の人数', i.specialDependents],
    ['その他の所得控除', i.otherDeductionYen],
  ]
  for (const [label, v] of nums) {
    if (v === null) continue
    if (!Number.isFinite(v) || v < 0) errors.push(`${label}は0以上の数値で入力してください。`)
  }
  if (Number.isFinite(i.salaryYen) && i.salaryYen > 1_000_000_000) errors.push('給与収入が大きすぎます。')
  return errors
}

export function calculateLimit(i: LimitInput): LimitResult {
  const warnings: string[] = []
  const salary = Math.floor(i.salaryYen)
  const si = i.socialInsuranceYen === null ? Math.floor(salary * SOCIAL_INSURANCE_AUTO_RATE) : Math.floor(i.socialInsuranceYen)
  const salaryIncome = Math.max(salary - salaryIncomeDeduction(salary), 0)
  const general = Math.floor(i.generalDependents)
  const special = Math.floor(i.specialDependents)
  const other = Math.floor(i.otherDeductionYen)

  const [spIT, spRT] = i.spouse === 'deduction' ? spouseDeduction(salaryIncome) : [0, 0]
  if (i.spouse === 'deduction' && spIT === 0) warnings.push('所得が1,000万円を超えるため配偶者控除は適用されません。')

  const itDeductions = si + incomeTaxBasicDeduction(salaryIncome) + spIT + general * 380_000 + special * 630_000 + other
  const rtDeductions = si + residentTaxBasicDeduction(salaryIncome) + spRT + general * 330_000 + special * 450_000 + other
  const incomeTaxable = floor1000(salaryIncome - itDeductions)
  const residentTaxable = floor1000(salaryIncome - rtDeductions)
  const rate = incomeTaxRate(incomeTaxable)

  // 調整控除（人的控除の差額×5%）。基礎控除差は5万円で固定として扱う。
  let diff = 50_000
  if (i.spouse === 'deduction') diff += spRT > 0 ? 50_000 : 0
  diff += general * 50_000 + special * 180_000
  let adjustment: number
  if (residentTaxable <= 0) adjustment = 0
  else if (residentTaxable <= 2_000_000) adjustment = Math.floor(Math.min(diff, residentTaxable) * 0.05)
  else adjustment = Math.max(Math.floor((diff - (residentTaxable - 2_000_000)) * 0.05), 2_500)

  const portion = Math.max(Math.floor(residentTaxable * 0.1) - adjustment, 0)
  const denom = 0.9 - rate * 1.021
  let limit = portion > 0 ? Math.floor((portion * 0.2) / denom + 2000) : 0
  limit = Math.floor(limit / 1000) * 1000

  if (portion === 0) warnings.push('住民税の所得割が0円と試算されるため、控除上限額は0円です。')
  if (salary > 20_000_000) warnings.push('給与収入2,000万円超は特例が異なるため、この試算の精度は低くなります。')
  if (other > 0) warnings.push('医療費控除・住宅ローン控除などがある場合、実際の上限額は変わります。詳細な確認をおすすめします。')

  return {
    salaryIncomeYen: salaryIncome,
    socialInsuranceYen: si,
    incomeTaxableYen: incomeTaxable,
    incomeTaxRate: rate,
    residentTaxableYen: residentTaxable,
    residentTaxIncomePortionYen: portion,
    adjustmentCreditYen: adjustment,
    limitYen: limit,
    warnings,
  }
}
