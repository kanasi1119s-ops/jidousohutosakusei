// 計算に使う制度パラメータ。制度改正時はこのファイルだけを更新する。
// 基準日: 2026-11-28 / 対象: 2026年（令和8年）1月〜12月の寄附
// 出典: 総務省・国税庁・財務省の公表資料に基づく一般的な算式（一次情報URLの最終確認は人間が行うこと。docs/LEGAL.md 参照）

export const PARAMS_AS_OF = '2026-11-28'

/** 給与所得控除（2025年分以降・最低保障額65万円）。[収入の上限, 率, 加算額]。 */
export const SALARY_DEDUCTION_TABLE: ReadonlyArray<{ upTo: number; rate: number; add: number }> = [
  { upTo: 1_625_000, rate: 0, add: 650_000 },
  { upTo: 1_800_000, rate: 0.4, add: -100_000 },
  { upTo: 3_600_000, rate: 0.3, add: 80_000 },
  { upTo: 6_600_000, rate: 0.2, add: 440_000 },
  { upTo: 8_500_000, rate: 0.1, add: 1_100_000 },
  { upTo: Infinity, rate: 0, add: 1_950_000 },
]

/** 住民税の基礎控除（合計所得金額に応じる）。 */
export const RESIDENT_BASIC_DEDUCTION: ReadonlyArray<{ upTo: number; amount: number }> = [
  { upTo: 24_000_000, amount: 430_000 },
  { upTo: 24_500_000, amount: 290_000 },
  { upTo: 25_000_000, amount: 150_000 },
  { upTo: Infinity, amount: 0 },
]

/**
 * 所得税の基礎控除（2026年分・目安）。令和8年度税制改正の報道・解説ベース。
 * 所得税率の区分判定にのみ使う。一次情報での最終確認が必要（要人間確認）。
 */
export const INCOME_TAX_BASIC_DEDUCTION: ReadonlyArray<{ upTo: number; amount: number }> = [
  { upTo: 4_890_000, amount: 1_040_000 },
  { upTo: 6_550_000, amount: 670_000 },
  { upTo: 23_500_000, amount: 620_000 },
  { upTo: 24_000_000, amount: 420_000 },
  { upTo: 24_500_000, amount: 280_000 },
  { upTo: 25_000_000, amount: 140_000 },
  { upTo: Infinity, amount: 0 },
]

/** 所得税の税率表（課税所得に対する税率）。 */
export const INCOME_TAX_BRACKETS: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 1_950_000, rate: 0.05 },
  { upTo: 3_300_000, rate: 0.1 },
  { upTo: 6_950_000, rate: 0.2 },
  { upTo: 9_000_000, rate: 0.23 },
  { upTo: 18_000_000, rate: 0.33 },
  { upTo: 40_000_000, rate: 0.4 },
  { upTo: Infinity, rate: 0.45 },
]

/** 人的控除額（住民税 / 所得税）。調整控除の「人的控除額の差」にも使う。 */
export const PERSONAL = {
  spouse: { resident: 330_000, income: 380_000 },
  dependentGeneral: { resident: 330_000, income: 380_000 }, // 16〜18歳・23〜69歳
  dependentSpecific: { resident: 450_000, income: 630_000 }, // 19〜22歳
  dependentElderly: { resident: 380_000, income: 480_000 }, // 70歳以上
  basicDiff: 50_000, // 基礎控除の差（所得税 − 住民税、従来の差額を維持した目安）
} as const

/** 配偶者控除の本人合計所得による逓減（住民税）。 */
export const SPOUSE_RESIDENT_TIERS: ReadonlyArray<{ upTo: number; ratio: number }> = [
  { upTo: 9_000_000, ratio: 1 },
  { upTo: 9_500_000, ratio: 2 / 3 },
  { upTo: 10_000_000, ratio: 1 / 3 },
  { upTo: Infinity, ratio: 0 },
]

export const SOCIAL_INSURANCE_DEFAULT_RATE = 0.15 // 社会保険料の概算率（入力が無い場合）
export const SELF_BURDEN_YEN = 2_000
export const SPECIAL_DEDUCTION_BASE = 0.9 // 90% − 所得税率×1.021
export const RECONSTRUCTION_FACTOR = 1.021
export const LIMIT_RATIO_OF_RESIDENT_TAX = 0.2
export const SAFETY_MARGIN = 0.9 // 「余裕を見た目安」は上限目安の90%

export const MAX_SALARY_YEN = 1_000_000_000
