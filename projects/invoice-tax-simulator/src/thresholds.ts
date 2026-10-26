// 制度パラメータ。法改正に追従するため、数値・文言はこのファイルのみ更新すれば画面全体に反映される。
// ※ 国税庁サイトへは本ツール作成時に直接アクセスできなかったため、税理士事務所等の解説に基づく値を含む。
//   公開前に必ず国税庁の最新資料で確認すること（docs/LEGAL.md 参照）。

export const AS_OF = '2026年10月26日'

export type TaxYear = 2026 | 2027 | 2028
export const TAX_YEARS: TaxYear[] = [2026, 2027, 2028]

/** 消費税・地方消費税の合計税率（標準10%、軽減8%）。国税:地方税 = 78:22 */
export const RATE_STANDARD = 10
export const RATE_REDUCED = 8
export const NATIONAL_SHARE = 78
export const LOCAL_SHARE = 22

/** 簡易課税のみなし仕入率（事業区分 第1種〜第6種） */
export const DEEMED_PURCHASE_RATE: Record<number, number> = {
  1: 90,
  2: 80,
  3: 70,
  4: 60,
  5: 50,
  6: 40,
}

export const BUSINESS_TYPE_LABELS: Record<number, string> = {
  1: '第1種（卸売業）90%',
  2: '第2種（小売業・農林水産業の飲食料品譲渡）80%',
  3: '第3種（製造業・建設業など）70%',
  4: '第4種（飲食店業など）60%',
  5: '第5種（運輸通信・金融保険・サービス業）50%',
  6: '第6種（不動産業）40%',
}

/** 2割特例・3割特例・免税事業者の基準期間課税売上高の上限（円） */
export const SPECIAL_LIMIT_YEN = 10_000_000
/** 簡易課税の基準期間課税売上高の上限（円） */
export const SIMPLIFIED_LIMIT_YEN = 50_000_000

export const SPECIAL_RATE_PERCENT: Record<TaxYear, number> = {
  2026: 20,
  2027: 30,
  2028: 30,
}

export const SPECIAL_LABEL: Record<TaxYear, string> = {
  2026: '2割特例',
  2027: '3割特例',
  2028: '3割特例',
}

/** 免税事業者等からの課税仕入れに対する経過措置の控除割合（%） */
export const TRANSITIONAL_RATIOS = [80, 70, 50, 30, 0]
export const DEFAULT_TRANSITIONAL_RATIO: Record<TaxYear, number> = {
  2026: 80,
  2027: 70,
  2028: 70,
}

export const TRANSITIONAL_SCHEDULE_NOTE =
  '免税事業者等からの仕入れに係る経過措置の控除割合: 〜2026年9月は80%、2026年10月〜2028年9月は70%、' +
  '2028年10月〜2030年9月は50%、2030年10月〜2031年9月は30%（以降0%）（解説記事に基づく。期間は要確認）。'

export const SOURCE_NOTE =
  '制度の内容は、令和8年度税制改正（2割特例の終了・個人事業者向け3割特例の創設・経過措置の見直し）に関する' +
  '税理士事務所等の解説記事および国税庁公表資料の見出し情報に基づく目安です。' +
  '国税庁の一次資料を直接確認できていないため、適用要件・数値は必ず国税庁の最新情報で確認してください。'
