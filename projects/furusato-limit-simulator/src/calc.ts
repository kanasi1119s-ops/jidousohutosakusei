// ふるさと納税 控除上限額の目安を計算する純粋関数群。
// 対象: 給与所得者（令和8年＝2026年中の寄附、令和8年分所得税・令和9年度住民税）。
// 方針: 判定に迷う項目は「控除が小さくなる＝上限額が低めに出る」安全側に倒す。

export type SpouseType = 'none' | 'deduction'

export interface FurusatoInput {
  /** 給与収入（額面・年間, 円） */
  annualSalaryYen: number
  /** 社会保険料（年間, 円）。null の場合は給与収入の15%で概算する */
  socialInsuranceYen: number | null
  /** その他の所得控除合計（生命保険料・iDeCo・医療費控除など, 円） */
  otherDeductionsYen: number
  /** 配偶者: none=なし/控除対象外, deduction=配偶者控除の対象（配偶者の給与収入123万円以下） */
  spouse: SpouseType
  /** 一般の扶養親族（16歳以上、19〜22歳を除く）の人数 */
  generalDependents: number
  /** 特定扶養親族（19〜22歳）の人数 */
  specialDependents: number
  /** 今年すでに寄附した額（円） */
  alreadyDonatedYen: number
}

export interface FurusatoResult {
  salaryIncomeYen: number
  salaryDeductionYen: number
  socialInsuranceYen: number
  incomeTaxTaxableYen: number
  residentTaxTaxableYen: number
  incomeTaxRate: number
  residentTaxBeforeAdjustYen: number
  adjustmentDeductionYen: number
  residentTaxIncomePortionYen: number
  /** 控除上限額の目安（円, 1,000円未満切り捨て） */
  limitYen: number
  /** 余裕をみた目安（上限額×0.9, 1,000円未満切り捨て） */
  safeLimitYen: number
  /** 上限額の目安からすでに寄附した額を引いた残り（負なら超過） */
  remainingYen: number
  /** 自己負担2,000円（寄附済み額が2,000円未満ならその額） */
  selfPayYen: number
}

export const AS_OF = '2026年11月25日'

export function salaryDeduction(salary: number): number {
  // 令和7年分以降（最低保障額65万円）
  if (salary <= 1_625_000) return Math.min(salary, 650_000)
  if (salary <= 1_800_000) return Math.floor(salary * 0.4) - 100_000
  if (salary <= 3_600_000) return Math.floor(salary * 0.3) + 80_000
  if (salary <= 6_600_000) return Math.floor(salary * 0.2) + 440_000
  if (salary <= 8_500_000) return Math.floor(salary * 0.1) + 1_100_000
  return 1_950_000
}

export function incomeTaxBasicDeduction(totalIncome: number): number {
  // 令和7・8年分の基礎控除（特例加算を含む）
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

/** 配偶者控除額 [所得税, 住民税]。本人の合計所得金額による段階 */
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

const floorTo = (v: number, unit: number) => Math.floor(v / unit) * unit

export function estimateSocialInsurance(salary: number): number {
  return Math.round(salary * 0.15)
}

export function validateInput(input: FurusatoInput): string[] {
  const errors: string[] = []
  const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (!isNum(input.annualSalaryYen) || input.annualSalaryYen <= 0) {
    errors.push('給与収入は1円以上の数値で入力してください。')
  } else if (input.annualSalaryYen > 30_000_000) {
    errors.push('給与収入は3,000万円以下で入力してください（それ以上は本ツールの対象外です）。')
  }
  if (input.socialInsuranceYen !== null) {
    if (!isNum(input.socialInsuranceYen) || input.socialInsuranceYen < 0) {
      errors.push('社会保険料は0以上の数値で入力してください（空欄なら給与収入の15%で概算します）。')
    } else if (isNum(input.annualSalaryYen) && input.socialInsuranceYen > input.annualSalaryYen) {
      errors.push('社会保険料が給与収入を超えています。')
    }
  }
  if (!isNum(input.otherDeductionsYen) || input.otherDeductionsYen < 0) {
    errors.push('その他の所得控除は0以上の数値で入力してください。')
  } else if (isNum(input.annualSalaryYen) && input.otherDeductionsYen > input.annualSalaryYen) {
    errors.push('その他の所得控除が給与収入を超えています。')
  }
  for (const [label, v] of [
    ['一般の扶養親族', input.generalDependents],
    ['特定扶養親族', input.specialDependents],
  ] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 20) {
      errors.push(`${label}の人数は0〜20の整数で入力してください。`)
    }
  }
  if (!isNum(input.alreadyDonatedYen) || input.alreadyDonatedYen < 0) {
    errors.push('寄附済み額は0以上の数値で入力してください。')
  } else if (input.alreadyDonatedYen > 1_000_000_000) {
    errors.push('寄附済み額は10億円以下で入力してください。')
  }
  return errors
}

export function calculate(input: FurusatoInput): FurusatoResult {
  const salary = Math.floor(input.annualSalaryYen)
  const si = Math.floor(input.socialInsuranceYen ?? estimateSocialInsurance(salary))
  const other = Math.floor(input.otherDeductionsYen)
  const sd = salaryDeduction(salary)
  const income = Math.max(0, salary - sd)

  const [spouseIT, spouseRT] = input.spouse === 'deduction' ? spouseDeduction(income) : [0, 0]
  const depIT = input.generalDependents * 380_000 + input.specialDependents * 630_000
  const depRT = input.generalDependents * 330_000 + input.specialDependents * 450_000

  const itTaxable = floorTo(
    Math.max(0, income - si - other - incomeTaxBasicDeduction(income) - spouseIT - depIT),
    1000,
  )
  const rtTaxable = floorTo(
    Math.max(0, income - si - other - residentTaxBasicDeduction(income) - spouseRT - depRT),
    1000,
  )

  // 住民税の人的控除差（調整控除用）
  const basicDiff = 50_000
  const spouseDiff = spouseIT - spouseRT
  const diffSum =
    basicDiff + spouseDiff + input.generalDependents * 50_000 + input.specialDependents * 180_000
  let adjustBase: number
  if (rtTaxable <= 2_000_000) adjustBase = Math.min(diffSum, rtTaxable)
  else adjustBase = Math.max(diffSum - (rtTaxable - 2_000_000), 50_000)
  const adjustment = Math.floor(adjustBase * 0.05)

  const rtBefore = floorTo(rtTaxable * 0.1, 100)
  const rtPortion = Math.max(0, rtBefore - adjustment)

  const rate = incomeTaxRate(itTaxable)
  const raw = (rtPortion * 0.2) / (0.9 - rate * 1.021) + 2000
  const limit = rtPortion === 0 ? 0 : floorTo(raw, 1000)
  const safe = floorTo(limit * 0.9, 1000)

  return {
    salaryIncomeYen: income,
    salaryDeductionYen: sd,
    socialInsuranceYen: si,
    incomeTaxTaxableYen: itTaxable,
    residentTaxTaxableYen: rtTaxable,
    incomeTaxRate: rate,
    residentTaxBeforeAdjustYen: rtBefore,
    adjustmentDeductionYen: adjustment,
    residentTaxIncomePortionYen: rtPortion,
    limitYen: limit,
    safeLimitYen: safe,
    remainingYen: limit - Math.floor(input.alreadyDonatedYen),
    selfPayYen: Math.min(2000, Math.floor(input.alreadyDonatedYen)),
  }
}
