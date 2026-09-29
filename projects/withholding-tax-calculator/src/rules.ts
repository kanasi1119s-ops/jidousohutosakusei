// 源泉徴収税額の計算ルール（基準日: 2026-09-29）
// 出典: 国税庁 タックスアンサー No.2795「原稿料や講演料等を支払ったとき」、No.2792「源泉徴収が必要な報酬・料金等とは」
// 復興特別所得税を含む税率 10.21%（支払金額100万円以下の部分）、20.42%（100万円を超える部分）。
export const AS_OF = '2026-09-29'

export const SOURCE_NOTE =
  '出典: 国税庁 タックスアンサー No.2795「原稿料や講演料等を支払ったとき」／No.2792「源泉徴収が必要な報酬・料金等とは」（基準日: ' +
  AS_OF +
  '）。復興特別所得税を含む税率です。'

export type Category = 'author' | 'professional'

export const CATEGORY_LABELS: Record<Category, string> = {
  author: '原稿料・講演料・デザイン料など',
  professional: '弁護士・税理士・公認会計士などへの報酬',
}

export const TAX_RATES = [10, 8, 0] as const

export const MAX_AMOUNT_YEN = 100_000_000_000

/** 100万円以下: 10.21% / 100万円超: 超過分20.42% + 102,100円。円未満切り捨て（整数演算で誤差を避ける）。 */
export function withholdingOf(subjectYen: number): number {
  if (subjectYen <= 0) return 0
  if (subjectYen <= 1_000_000) return Math.floor((subjectYen * 1021) / 10000)
  return Math.floor(((subjectYen - 1_000_000) * 2042) / 10000) + 102_100
}
