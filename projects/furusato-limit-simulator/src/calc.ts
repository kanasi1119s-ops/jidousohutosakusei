// ふるさと納税の控除上限額（目安）を、給与所得者・簡易モデルで試算する。
// 令和7年度税制改正（給与所得控除の最低保障額65万円、基礎控除の引き上げ）後の水準を採用。
// 実際の上限額は住民税の課税内容によって変わるため、あくまで目安である。

export interface SimulatorInput {
  /** 給与収入（額面・年額、円） */
  salaryYen: number
  /** 社会保険料の年額（円）。null の場合は給与収入の概算率で自動計算する */
  socialInsuranceYen: number | null
  /** 配偶者・扶養・生命保険料・iDeCoなど、基礎控除以外の所得控除の合計（円） */
  extraDeductionYen: number
  /** 今年すでに寄附した金額（円） */
  donatedYen: number
}

export interface SimulationResult {
  salaryYen: number
  employmentIncomeYen: number
  socialInsuranceYen: number
  incomeTaxTaxableYen: number
  residentTaxTaxableYen: number
  incomeTaxRate: number
  residentTaxIncomePortionYen: number
  limitYen: number
  safeLimitYen: number
  remainingYen: number
  selfBurdenYen: number
}

export const AUTO_SOCIAL_INSURANCE_RATE = 0.15
export const SELF_BURDEN_YEN = 2000
export const MAX_SALARY_YEN = 20_000_000

/** 給与所得控除額（令和7年分以降） */
export function employmentIncomeDeduction(salary: number): number {
  if (salary <= 1_900_000) return Math.min(650_000, salary)
  if (salary <= 3_600_000) return Math.floor(salary * 0.3) + 80_000
  if (salary <= 6_600_000) return Math.floor(salary * 0.2) + 440_000
  if (salary <= 8_500_000) return Math.floor(salary * 0.1) + 1_100_000
  return 1_950_000
}

/** 所得税の基礎控除（令和7・8年分、合計所得金額に応じる） */
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

/** 住民税の基礎控除 */
export function residentTaxBasicDeduction(totalIncome: number): number {
  if (totalIncome <= 24_000_000) return 430_000
  if (totalIncome <= 24_500_000) return 290_000
  if (totalIncome <= 25_000_000) return 150_000
  return 0
}

/** 所得税の税率（課税所得に対する限界税率） */
export function incomeTaxRate(taxable: number): number {
  if (taxable <= 1_950_000) return 0.05
  if (taxable <= 3_300_000) return 0.1
  if (taxable <= 6_950_000) return 0.2
  if (taxable <= 9_000_000) return 0.23
  if (taxable <= 18_000_000) return 0.33
  if (taxable <= 40_000_000) return 0.4
  return 0.45
}

/** 調整控除（基礎控除の差額5万円のみを考慮した簡易計算） */
function adjustmentDeduction(taxable: number): number {
  const diff = 50_000
  if (taxable <= 2_000_000) return Math.floor(Math.min(diff, taxable) * 0.05)
  return Math.max(2_500, Math.floor((diff - (taxable - 2_000_000)) * 0.05))
}

export function simulate(input: SimulatorInput): SimulationResult {
  const salary = Math.floor(input.salaryYen)
  const employmentIncome = Math.max(0, salary - employmentIncomeDeduction(salary))
  const social =
    input.socialInsuranceYen === null
      ? Math.floor(salary * AUTO_SOCIAL_INSURANCE_RATE)
      : Math.floor(input.socialInsuranceYen)
  const extra = Math.floor(input.extraDeductionYen)

  const itTaxable = Math.max(
    0,
    employmentIncome - social - extra - incomeTaxBasicDeduction(employmentIncome),
  )
  const rtTaxable = Math.max(
    0,
    employmentIncome - social - extra - residentTaxBasicDeduction(employmentIncome),
  )

  const rate = incomeTaxRate(itTaxable)
  const portion = Math.max(0, Math.floor(rtTaxable * 0.1) - (rtTaxable > 0 ? adjustmentDeduction(rtTaxable) : 0))

  // 住民税の特例控除の上限は所得割額の20%。控除率は 90% - 所得税率×1.021（復興特別所得税を含む）
  const limit =
    portion === 0 ? 0 : Math.floor((portion * 0.2) / (0.9 - rate * 1.021)) + SELF_BURDEN_YEN
  const limitRounded = Math.floor(limit / 100) * 100
  const safe = Math.floor((limitRounded * 0.9) / 100) * 100
  const donated = Math.max(0, Math.floor(input.donatedYen))

  return {
    salaryYen: salary,
    employmentIncomeYen: employmentIncome,
    socialInsuranceYen: social,
    incomeTaxTaxableYen: itTaxable,
    residentTaxTaxableYen: rtTaxable,
    incomeTaxRate: rate,
    residentTaxIncomePortionYen: portion,
    limitYen: limitRounded,
    safeLimitYen: safe,
    remainingYen: Math.max(0, limitRounded - donated),
    selfBurdenYen: limitRounded > 0 ? SELF_BURDEN_YEN : 0,
  }
}

/** 全角数字・カンマ・「円」・空白を許容して数値に変換する。解釈できなければ NaN */
export function parseYenText(text: string): number {
  const normalized = text
    .normalize('NFKC')
    .replace(/[,\s円]/g, '')
    .trim()
  if (normalized === '') return NaN
  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN
  return Number(normalized)
}

export function validateInput(input: SimulatorInput): string[] {
  const errors: string[] = []
  const num = (v: number) => Number.isFinite(v)
  if (!num(input.salaryYen) || input.salaryYen < 0) {
    errors.push('給与収入は0以上の数値で入力してください。')
  } else if (input.salaryYen > MAX_SALARY_YEN) {
    errors.push('給与収入が2,000万円を超える場合は、本ツールの簡易モデルの対象外です。')
  }
  if (input.socialInsuranceYen !== null && (!num(input.socialInsuranceYen) || input.socialInsuranceYen < 0)) {
    errors.push('社会保険料は0以上の数値で入力してください（空欄なら自動概算）。')
  }
  if (!num(input.extraDeductionYen) || input.extraDeductionYen < 0) {
    errors.push('その他の所得控除は0以上の数値で入力してください。')
  }
  if (!num(input.donatedYen) || input.donatedYen < 0) {
    errors.push('寄附済み額は0以上の数値で入力してください。')
  }
  return errors
}

/** 年収別の目安表（単身・追加控除なしの場合） */
export function referenceTable(): { salaryYen: number; limitYen: number }[] {
  const rows: { salaryYen: number; limitYen: number }[] = []
  for (let man = 300; man <= 1000; man += 100) {
    const salaryYen = man * 10_000
    rows.push({
      salaryYen,
      limitYen: simulate({ salaryYen, socialInsuranceYen: null, extraDeductionYen: 0, donatedYen: 0 })
        .limitYen,
    })
  }
  return rows
}
