// 新NISA（2024年開始）の投資枠。金融庁の公表内容に基づく目安。
// 2026年度税制改正大綱（2025年12月）: 2027年から18歳未満向けつみたて投資枠（年60万円・上限600万円）
// および売却枠の当年中復活が予定されているが、本ツールは18歳以上・売却なしを前提とする。
export const AS_OF = '2026年9月'
export const TSUMITATE_ANNUAL_YEN = 1_200_000
export const GROWTH_ANNUAL_YEN = 2_400_000
export const LIFETIME_TOTAL_YEN = 18_000_000
export const LIFETIME_GROWTH_YEN = 12_000_000
export const TAX_RATE = 0.20315

export const SOURCE_NOTE =
  '投資枠は金融庁「新しいNISA」の公表内容（つみたて投資枠 年120万円／成長投資枠 年240万円／非課税保有限度額 1,800万円・うち成長投資枠 1,200万円）に基づく目安です。' +
  '課税口座の税率は所得税・復興特別所得税・住民税の合計 20.315% を用いています。最新情報は金融庁・国税庁の公表資料をご確認ください。'
