// 令和8年度税制改正大綱（2025-12公表）に基づく目安値。確定値・一次情報は docs/LEGAL.md の確認事項を参照。
// 制度改正があった場合は、このファイルの値だけを更新すれば計算に反映される。
export const AS_OF = '2026-10-29'

export const SOURCE_NOTE =
  '令和8年度税制改正大綱・各種解説記事に基づく目安値です（国税庁・総務省の一次情報での確認が必要です）。'

// 給与所得控除の最低保障額（令和8・9年分の特例込み: 本則69万円 + 特例5万円）
export const SALARY_DEDUCTION_MIN = 740_000

// 所得税の基礎控除（合計所得金額の上限, 控除額）。※489万円超655万円以下の区分は要一次情報確認
export const BASIC_DEDUCTION_INCOME_TAX: ReadonlyArray<readonly [number, number]> = [
  [4_890_000, 1_040_000],
  [6_550_000, 670_000],
  [23_500_000, 620_000],
  [24_000_000, 480_000],
  [24_500_000, 320_000],
  [25_000_000, 160_000],
]

// 住民税の基礎控除（合計所得金額の上限, 控除額）
export const BASIC_DEDUCTION_RESIDENT: ReadonlyArray<readonly [number, number]> = [
  [24_000_000, 430_000],
  [24_500_000, 290_000],
  [25_000_000, 150_000],
]

// 人的控除（所得税 / 住民税）
export const SPOUSE_DEDUCTION = { incomeTax: 380_000, resident: 330_000 }
export const DEPENDENT_DEDUCTION = { incomeTax: 380_000, resident: 330_000 }
export const SPECIAL_DEPENDENT_DEDUCTION = { incomeTax: 630_000, resident: 450_000 }

// 所得税の税率表（課税所得の上限, 税率）
export const INCOME_TAX_BRACKETS: ReadonlyArray<readonly [number, number]> = [
  [1_950_000, 0.05],
  [3_300_000, 0.1],
  [6_950_000, 0.2],
  [9_000_000, 0.23],
  [18_000_000, 0.33],
  [40_000_000, 0.4],
  [Number.POSITIVE_INFINITY, 0.45],
]

export const RECONSTRUCTION_SURTAX = 1.021
export const SELF_PAYMENT_YEN = 2_000
