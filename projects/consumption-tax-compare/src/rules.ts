// 制度パラメーター。制度改正（令和8年度税制改正）の内容を反映した目安値。
// 値を更新する場合はこのファイルのみを編集し、docs/LEGAL.md の出典・基準日も更新すること。

export const AS_OF = '2026年10月5日時点'

export const SOURCE_NOTE =
  '制度の根拠: 令和8年度税制改正（所得税法等の一部を改正する法律（令和8年法律第12号）、令和8年3月31日公布と報じられています）。' +
  '一次情報は財務省「令和8年度税制改正」・国税庁「インボイス制度の経過措置の見直し」のページでご確認ください。'

export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6

export const BUSINESS_TYPES: { type: BusinessType; label: string; deemedRate: number }[] = [
  { type: 1, label: '第1種（卸売業）', deemedRate: 0.9 },
  { type: 2, label: '第2種（小売業・農林水産業（食用））', deemedRate: 0.8 },
  { type: 3, label: '第3種（製造業・建設業等）', deemedRate: 0.7 },
  { type: 4, label: '第4種（飲食店業等・他の区分に該当しないもの）', deemedRate: 0.6 },
  { type: 5, label: '第5種（サービス業・運輸通信業・金融保険業）', deemedRate: 0.5 },
  { type: 6, label: '第6種（不動産業）', deemedRate: 0.4 },
]

export const SUPPORTED_YEARS = [2026, 2027, 2028, 2029, 2030, 2031] as const
export type SupportedYear = (typeof SUPPORTED_YEARS)[number]

// 適格請求書発行事業者以外（免税事業者等）からの課税仕入れに係る経過措置の控除割合。
// [1/1〜9/30, 10/1〜12/31]（暦年の個人事業者の場合）
export const TRANSITIONAL_RATES: Record<SupportedYear, [number, number]> = {
  2026: [0.8, 0.7],
  2027: [0.7, 0.7],
  2028: [0.7, 0.5],
  2029: [0.5, 0.5],
  2030: [0.5, 0.3],
  2031: [0.3, 0],
}

export const TWO_TENTHS_YEAR: SupportedYear = 2026 // 2割特例: 個人事業者は令和8年分が最後
export const THREE_TENTHS_YEARS: readonly SupportedYear[] = [2027, 2028] // 3割特例: 令和9年分・令和10年分

export const SPECIAL_BASE_LIMIT_YEN = 10_000_000 // 2割・3割特例: 基準期間の課税売上高
export const SIMPLIFIED_BASE_LIMIT_YEN = 50_000_000 // 簡易課税: 基準期間の課税売上高

export const NATIONAL_RATE_STANDARD = 0.078
export const NATIONAL_RATE_REDUCED = 0.0624
export const LOCAL_TO_NATIONAL = 22 / 78 // 地方消費税 = 国税 × 22/78
