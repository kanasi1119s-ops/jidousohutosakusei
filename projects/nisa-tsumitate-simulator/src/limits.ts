// 新NISA（18歳以上）の投資枠。基準日: 2026-11-05。
// 出典: 金融庁「NISA特設ウェブサイト」等。最新の制度は必ず公式情報で確認してください。
export const AS_OF = '2026-11-05'
export const TSUMITATE_ANNUAL_LIMIT_YEN = 1_200_000 // つみたて投資枠 年間
export const GROWTH_ANNUAL_LIMIT_YEN = 2_400_000 // 成長投資枠 年間
export const LIFETIME_LIMIT_YEN = 18_000_000 // 非課税保有限度額（簿価）
export const GROWTH_LIFETIME_LIMIT_YEN = 12_000_000 // うち成長投資枠
export const TAXABLE_ACCOUNT_TAX_RATE = 0.20315 // 特定口座の譲渡益課税（所得税・復興特別所得税・住民税）

export const SOURCE_NOTE =
  '投資枠は金融庁公表の新NISA制度（18歳以上: つみたて投資枠 年120万円・成長投資枠 年240万円・' +
  '非課税保有限度額 1,800万円（うち成長投資枠 1,200万円））に基づく目安です。2027年1月開始予定の' +
  '18歳未満向けつみたて投資枠は本ツールでは扱いません。'
