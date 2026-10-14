// 免税事業者等（適格請求書発行事業者以外）からの課税仕入れに係る経過措置の控除割合。
// 令和8年度税制改正後のスケジュール（2026年10月時点で複数の税理士法人等の解説が一致）。
// ※ 国税庁の一次情報での最終確認は人間が行うこと（docs/LEGAL.md 参照）。

export interface CreditPeriod {
  id: string
  label: string
  /** 期間開始日（YYYY-MM-DD、含む） */
  from: string
  /** 期間終了日（YYYY-MM-DD、含む）。null は無期限 */
  to: string | null
  /** 控除できる割合（0〜1） */
  ratio: number
}

export const AS_OF = '2026-10-14'

export const CREDIT_PERIODS: CreditPeriod[] = [
  { id: 'p0', label: 'インボイス制度開始前', from: '0001-01-01', to: '2023-09-30', ratio: 1 },
  { id: 'p1', label: '2023/10/1〜2026/9/30', from: '2023-10-01', to: '2026-09-30', ratio: 0.8 },
  { id: 'p2', label: '2026/10/1〜2028/9/30', from: '2026-10-01', to: '2028-09-30', ratio: 0.7 },
  { id: 'p3', label: '2028/10/1〜2030/9/30', from: '2028-10-01', to: '2030-09-30', ratio: 0.5 },
  { id: 'p4', label: '2030/10/1〜2031/9/30', from: '2030-10-01', to: '2031-09-30', ratio: 0.3 },
  { id: 'p5', label: '2031/10/1以降', from: '2031-10-01', to: null, ratio: 0 },
]

/** 改正前（令和8年度改正前）の想定スケジュール。差額の比較表示にのみ使用する。 */
export const OLD_CREDIT_PERIODS: CreditPeriod[] = [
  { id: 'o0', label: 'インボイス制度開始前', from: '0001-01-01', to: '2023-09-30', ratio: 1 },
  { id: 'o1', label: '2023/10/1〜2026/9/30', from: '2023-10-01', to: '2026-09-30', ratio: 0.8 },
  { id: 'o2', label: '2026/10/1〜2029/9/30', from: '2026-10-01', to: '2029-09-30', ratio: 0.5 },
  { id: 'o3', label: '2029/10/1以降', from: '2029-10-01', to: null, ratio: 0 },
]

export function findPeriod(date: string, periods: CreditPeriod[] = CREDIT_PERIODS): CreditPeriod {
  // ISO形式の文字列は辞書順比較で日付順になる
  for (const p of periods) {
    if (date >= p.from && (p.to === null || date <= p.to)) return p
  }
  return periods[periods.length - 1]
}

export const SOURCE_NOTE =
  '控除割合は令和8年度税制改正後の経過措置（80%→70%→50%→30%→0%）に基づく目安です。' +
  '適用の可否・詳細は国税庁の最新の公表情報で必ず確認してください。'
