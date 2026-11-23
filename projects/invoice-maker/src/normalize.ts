/** 全角数字・全角記号を半角へ。カンマ・円記号・空白は除去する。 */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
}

export const MAX_INPUT = 1e12

/** 数値入力の正規化。解釈できなければ NaN。空文字も NaN。 */
export function parseNumberInput(raw: string): number {
  const s = toHalfWidth(raw).replace(/[,\s¥￥円]/g, '').replace(/[ー−－―]/g, '-')
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return NaN
  const n = Number(s)
  // 積・税計算が有限値に収まり、かつ現実的な範囲（±1兆）に限定する
  return Math.abs(n) <= MAX_INPUT ? n : NaN
}

/** 登録番号の正規化（全角→半角、空白除去、tを大文字化、ハイフン除去） */
export function normalizeRegNo(raw: string): string {
  return toHalfWidth(raw).replace(/[\s-]/g, '').toUpperCase()
}
