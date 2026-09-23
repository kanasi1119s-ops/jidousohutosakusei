export interface Threshold {
  id: string
  label: string
  manYen: number
  category: 'tax' | 'social'
  description: string
}

export const AS_OF = '2026-09-23'

export const SOURCE_NOTE =
  '各しきい値は国税庁・厚生労働省の公表資料および税制改正大綱の報道内容に基づく一般的な目安です（基準日: ' +
  AS_OF +
  '）。2025年度税制改正による基礎控除等の引き上げや、2026年10月の被用者保険適用要件（月額賃金要件）見直しなど、' +
  '制度は今後も変更される可能性があります。最終判断の前には必ず国税庁・厚生労働省の最新の公表情報、または税理士・社会保険労務士にご確認ください。'

export const THRESHOLDS: Threshold[] = [
  {
    id: 'resident-tax',
    label: '100万円の壁',
    manYen: 100,
    category: 'tax',
    description: '住民税がかかり始める目安（自治体・控除の内容により異なります）',
  },
  {
    id: 'income-tax',
    label: '123万円の壁',
    manYen: 123,
    category: 'tax',
    description: '所得税がかかり始める目安（2025年度税制改正で基礎控除等が引き上げられた後の水準）',
  },
  {
    id: 'social-106',
    label: '106万円の壁',
    manYen: 106,
    category: 'social',
    description:
      '一定規模以上の企業で働く場合の社会保険加入の目安（月額賃金要件は2026年10月に撤廃予定とされています）',
  },
  {
    id: 'social-130',
    label: '130万円の壁',
    manYen: 130,
    category: 'social',
    description: '配偶者などの扶養（社会保険の被扶養者）から外れる目安',
  },
  {
    id: 'spouse-150',
    label: '150万円の壁',
    manYen: 150,
    category: 'tax',
    description: '配偶者特別控除が満額から段階的に縮小し始める目安',
  },
  {
    id: 'spouse-201',
    label: '201万円の壁',
    manYen: 201,
    category: 'tax',
    description: '配偶者特別控除がなくなる目安',
  },
]
