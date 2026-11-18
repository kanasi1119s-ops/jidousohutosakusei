// ふるさと納税の控除上限額（目安）を給与所得者向けに計算する。
// 基準: 令和8年（2026年）分の所得税・令和9年度分の住民税を想定した簡易モデル。
// 住宅ローン控除・医療費控除・配当/譲渡所得・事業所得などは考慮しない（UIで明記）。

export const AS_OF = '2026年11月'
export const TAX_YEAR = 2026

export interface FurusatoInput {
  /** 給与収入（年額・円）。額面（源泉徴収票の「支払金額」） */
  salaryYen: number
  /** 社会保険料の年額（円）。null の場合は給与収入の15%で概算 */
  socialInsuranceYen: number | null
  /** iDeCo・小規模企業共済等の掛金（年額・円） */
  idecoYen: number
  /** その他の所得控除（生命保険料控除・医療費控除等の合計。所得税・住民税で同額とみなす） */
  otherDeductionYen: number
  /** 配偶者（給与収入160万円以下 = 配偶者控除・配偶者特別控除の満額相当）がいるか */
  hasSpouse: boolean
  /** 一般の扶養親族（16歳以上、19〜22歳を除く）の人数 */
  dependentsGeneral: number
  /** 特定扶養親族（19〜22歳）の人数 */
  dependentsSpecific: number
  /** すでに今年寄附した金額（円） */
  alreadyDonatedYen: number
}

export interface FurusatoResult {
  salaryIncomeYen: number // 給与所得
  socialInsuranceYen: number
  incomeTaxableYen: number // 所得税の課税所得
  residentTaxableYen: number // 住民税の課税所得
  incomeTaxRate: number // 所得税率（0.05 など）
  residentTaxIncomePortionYen: number // 住民税所得割額（調整控除後）
  limitYen: number // 上限額の目安（1円単位切り捨て）
  safeLimitYen: number // 余裕を持った目安（上限の90%、1,000円単位切り捨て）
  remainingYen: number // 上限 − 寄附済み（負なら0）
  selfPaymentYen: number
}

export const SELF_PAYMENT_YEN = 2000

/** 給与所得控除（令和7年分以降） */
export function salaryDeduction(salary: number): number {
  if (salary <= 1_625_000) return 650_000
  if (salary <= 1_800_000) return Math.floor(salary * 0.4) - 100_000
  if (salary <= 3_600_000) return Math.floor(salary * 0.3) + 80_000
  if (salary <= 6_600_000) return Math.floor(salary * 0.2) + 440_000
  if (salary <= 8_500_000) return Math.floor(salary * 0.1) + 1_100_000
  return 1_950_000
}

/** 所得税の基礎控除（令和7・8年分: 本則＋特例加算）。合計所得金額で判定 */
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

/** 所得税率（課税所得に対する限界税率） */
export function incomeTaxRate(taxable: number): number {
  if (taxable <= 1_950_000) return 0.05
  if (taxable <= 3_300_000) return 0.1
  if (taxable <= 6_950_000) return 0.2
  if (taxable <= 9_000_000) return 0.23
  if (taxable <= 18_000_000) return 0.33
  if (taxable <= 40_000_000) return 0.4
  return 0.45
}

export function validateInput(input: FurusatoInput): string[] {
  const errors: string[] = []
  const nonNeg = (v: number, name: string) => {
    if (!Number.isFinite(v) || v < 0) errors.push(`${name}は0以上の数値で入力してください。`)
  }
  nonNeg(input.salaryYen, '給与収入')
  if (input.socialInsuranceYen !== null) nonNeg(input.socialInsuranceYen, '社会保険料')
  nonNeg(input.idecoYen, 'iDeCo等の掛金')
  nonNeg(input.otherDeductionYen, 'その他の所得控除')
  nonNeg(input.dependentsGeneral, '一般の扶養親族の人数')
  nonNeg(input.dependentsSpecific, '特定扶養親族の人数')
  nonNeg(input.alreadyDonatedYen, '寄附済み金額')
  if (Number.isFinite(input.salaryYen) && input.salaryYen > 100_000_000) {
    errors.push('給与収入が大きすぎます（1億円以下で入力してください）。')
  }
  if (!Number.isInteger(input.dependentsGeneral) || !Number.isInteger(input.dependentsSpecific)) {
    errors.push('扶養親族の人数は整数で入力してください。')
  }
  if (input.dependentsGeneral > 20 || input.dependentsSpecific > 20) {
    errors.push('扶養親族の人数は20人以下で入力してください。')
  }
  if (input.salaryYen > 20_000_000) {
    errors.push('給与収入2,000万円超は寄附上限の計算が本ツールの対象外です（上限は定額となるため専門家にご相談ください）。')
  }
  return errors
}

export function calculate(input: FurusatoInput): FurusatoResult {
  const salary = Math.floor(input.salaryYen)
  const salaryIncome = Math.max(0, salary - salaryDeduction(salary))
  const si =
    input.socialInsuranceYen === null ? Math.floor(salary * 0.15) : Math.floor(input.socialInsuranceYen)
  const ideco = Math.floor(input.idecoYen)
  const other = Math.floor(input.otherDeductionYen)
  const nGen = Math.floor(input.dependentsGeneral)
  const nSpec = Math.floor(input.dependentsSpecific)

  // 人的控除（所得税 / 住民税）
  const spouseIT = input.hasSpouse ? 380_000 : 0
  const spouseRT = input.hasSpouse ? 330_000 : 0
  const depIT = nGen * 380_000 + nSpec * 630_000
  const depRT = nGen * 330_000 + nSpec * 450_000

  const common = si + ideco + other
  const itBasic = incomeTaxBasicDeduction(salaryIncome)
  const rtBasic = residentTaxBasicDeduction(salaryIncome)

  const incomeTaxable = Math.max(0, Math.floor((salaryIncome - common - itBasic - spouseIT - depIT) / 1000) * 1000)
  const residentTaxable = Math.max(0, Math.floor((salaryIncome - common - rtBasic - spouseRT - depRT) / 1000) * 1000)

  // 調整控除（人的控除額の差 × 5%）
  const diffBasic = 50_000
  const diffSpouse = input.hasSpouse ? 50_000 : 0
  const diffDep = nGen * 50_000 + nSpec * 180_000
  const diffSum = diffBasic + diffSpouse + diffDep
  let adjustment: number
  if (residentTaxable <= 2_000_000) {
    adjustment = Math.floor(Math.min(residentTaxable, diffSum) * 0.05)
  } else {
    adjustment = Math.max(2_500, Math.floor((diffSum - (residentTaxable - 2_000_000)) * 0.05))
  }

  const rate = incomeTaxRate(incomeTaxable)
  const residentIncomePortion = Math.max(0, Math.floor(residentTaxable * 0.1) - adjustment)

  let limit = 0
  if (residentIncomePortion > 0) {
    const denom = 0.9 - rate * 1.021
    limit = Math.floor((residentIncomePortion * 0.2) / denom + SELF_PAYMENT_YEN)
  }
  const safe = Math.floor((limit * 0.9) / 1000) * 1000
  const remaining = Math.max(0, limit - Math.floor(input.alreadyDonatedYen))

  return {
    salaryIncomeYen: salaryIncome,
    socialInsuranceYen: si,
    incomeTaxableYen: incomeTaxable,
    residentTaxableYen: residentTaxable,
    incomeTaxRate: rate,
    residentTaxIncomePortionYen: residentIncomePortion,
    limitYen: limit,
    safeLimitYen: safe,
    remainingYen: remaining,
    selfPaymentYen: limit > 0 ? SELF_PAYMENT_YEN : 0,
  }
}

/** 年収別の一覧（他の条件は同じ）。300万〜1,000万を100万円刻み */
export function salaryTable(base: FurusatoInput): { salaryYen: number; limitYen: number }[] {
  const rows: { salaryYen: number; limitYen: number }[] = []
  for (let s = 3_000_000; s <= 10_000_000; s += 500_000) {
    rows.push({ salaryYen: s, limitYen: calculate({ ...base, salaryYen: s, socialInsuranceYen: null }).limitYen })
  }
  return rows
}

/** 全角数字・全角カンマ・円記号・空白を取り除いて数値化する。空文字は null */
export function parseNumber(raw: string): number | null {
  const normalized = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,、\s円¥￥]/g, '')
    .replace(/[．。]/g, '.')
    .replace(/[－−ー]/g, '-')
  if (normalized === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN
  return Number(normalized)
}
