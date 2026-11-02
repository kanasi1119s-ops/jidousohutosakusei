// 税制パラメータ。制度改正時はこのファイルのみ更新する。
// 基準日・出典は main.ts のフッターと docs/LEGAL.md に表示する。
export const AS_OF = '2026-11-02'
export const TARGET_TAX_YEAR_NOTE =
  '令和8年（2026年）中の寄附・令和8年分所得を想定した概算です。令和8年度税制改正で決まった高所得者向けの上限見直しは令和10年度住民税以後の適用のため、本試算には含みません。'
export const SOURCE_NOTE =
  '計算方法は総務省「ふるさと納税ポータルサイト」で公表されている考え方（住民税所得割額の20％を目安とする近似式）に基づく概算です。各税額・控除額は国税庁・総務省・お住まいの自治体の最新情報で必ずご確認ください。'

/** 給与所得控除（令和7年分以後の所得税、令和8年度以後の住民税の規定に基づく概算） */
export function salaryIncomeDeduction(salary: number): number {
  if (salary <= 1_625_000) return 650_000
  if (salary <= 1_800_000) return salary * 0.4 - 100_000
  if (salary <= 3_600_000) return salary * 0.3 + 80_000
  if (salary <= 6_600_000) return salary * 0.2 + 440_000
  if (salary <= 8_500_000) return salary * 0.1 + 1_100_000
  return 1_950_000
}

/** 所得税の基礎控除（令和7・8年分の特例加算を含む概算。合計所得金額で判定） */
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

export const RESIDENT_BASIC_DEDUCTION = 430_000

/** 所得税の累進税率（限界税率） */
export function marginalIncomeTaxRate(taxable: number): number {
  if (taxable <= 1_950_000) return 0.05
  if (taxable <= 3_300_000) return 0.1
  if (taxable <= 6_950_000) return 0.2
  if (taxable <= 9_000_000) return 0.23
  if (taxable <= 18_000_000) return 0.33
  if (taxable <= 40_000_000) return 0.4
  return 0.45
}

/** 配偶者控除の本人所得による逓減（合計所得金額ベースで判定） */
export function spouseFactor(totalIncome: number): number {
  if (totalIncome <= 9_000_000) return 1
  if (totalIncome <= 9_500_000) return 26 / 38
  if (totalIncome <= 10_000_000) return 13 / 38
  return 0
}
