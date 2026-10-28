// 制度パラメータ。制度改正時はこのファイルのみ更新する。
// 出典は税制改正大綱の解説等の二次情報に基づく（国税庁サイトは本開発環境から取得できず未確認）。
// 公開前に人間が国税庁の一次情報で必ず確認すること（docs/LEGAL.md 参照）。

export const AS_OF = '2026-10-28'

export const TAX_RATE_STANDARD = 10
export const TAX_RATE_REDUCED = 8

export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6

export const BUSINESS_TYPES: { id: BusinessType; label: string; deemedRate: number }[] = [
  { id: 1, label: '第一種事業（卸売業）', deemedRate: 90 },
  { id: 2, label: '第二種事業（小売業・農林水産業（飲食料品））', deemedRate: 80 },
  { id: 3, label: '第三種事業（製造業・建設業・農林水産業など）', deemedRate: 70 },
  { id: 4, label: '第四種事業（飲食店業など）', deemedRate: 60 },
  { id: 5, label: '第五種事業（運輸通信業・金融保険業・サービス業）', deemedRate: 50 },
  { id: 6, label: '第六種事業（不動産業）', deemedRate: 40 },
]

export const TAX_YEARS = [2026, 2027, 2028] as const
export type TaxYear = (typeof TAX_YEARS)[number]

/** 簡易課税制度を選択できる基準期間の課税売上高の上限（税抜・円） */
export const SIMPLIFIED_BASE_SALES_LIMIT_YEN = 50_000_000
/** 2割特例・3割特例を使える目安となる基準期間の課税売上高の上限（税抜・円） */
export const SPECIAL_BASE_SALES_LIMIT_YEN = 10_000_000

/** 2割特例: 令和8年（2026年）分まで（個人事業者の暦年課税） */
export const TWO_WARI_YEARS: readonly number[] = [2026]
/** 3割特例: 令和9年・10年（2027・2028年）分、個人事業者のみ */
export const THREE_WARI_YEARS: readonly number[] = [2027, 2028]

export const SOURCE_NOTE =
  '制度の内容は令和8年度税制改正大綱とその解説（税理士法人等の公表資料）に基づく目安で、国税庁の一次情報での最終確認は未了です。'
