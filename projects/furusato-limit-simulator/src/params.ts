// 令和8年（2026年）中の寄附に適用される税制パラメータ。
// 出典・前提は docs/LEGAL.md を参照。公表情報の更新時はこのファイルのみを修正する。
export const TAX_YEAR_LABEL = '令和8年（2026年）中の寄附'
export const AS_OF = '2026-11-13'
export const SOURCE_NOTE =
  '計算式は総務省「ふるさと納税ポータルサイト」で公表されている控除上限額の考え方に基づく簡易試算です。' +
  '令和8年分所得税の基礎控除（合計所得489万円以下は104万円）・給与所得控除の最低保障額（74万円）等は、' +
  '税理士法人・会計事務所等の解説記事（2026年11月時点）を参考にしており、国税庁の一次情報での最終確認が必要です。'

/** 住民税所得割の税率（市区町村6%＋都道府県4%の標準税率。指定都市は市8%＋県2%で合計は同じ） */
export const RESIDENT_TAX_RATE = 0.1
/** 復興特別所得税を含む乗数 */
export const RECONSTRUCTION_MULTIPLIER = 1.021
/** 寄附者の自己負担額 */
export const SELF_PAYMENT_YEN = 2000
/** 社会保険料の概算率（健康保険＋厚生年金＋雇用保険の合計目安）。実額入力を推奨 */
export const SOCIAL_INSURANCE_ESTIMATE_RATE = 0.145

/** 所得税の速算表（課税所得の上限, 税率） */
export const INCOME_TAX_BRACKETS: ReadonlyArray<readonly [number, number]> = [
  [1_950_000, 0.05],
  [3_300_000, 0.1],
  [6_950_000, 0.2],
  [9_000_000, 0.23],
  [18_000_000, 0.33],
  [40_000_000, 0.4],
  [Number.POSITIVE_INFINITY, 0.45],
]

/** 給与所得控除の最低保障額（所得税・令和8〜9年分の特例込み / 住民税） */
export const SALARY_DEDUCTION_MIN_INCOME_TAX = 740_000
export const SALARY_DEDUCTION_MIN_RESIDENT_TAX = 650_000
/** 最低保障額が適用される給与収入の上限（所得税は特例込みで190万円以下を想定） */
export const SALARY_DEDUCTION_MIN_LIMIT_INCOME_TAX = 1_900_000
