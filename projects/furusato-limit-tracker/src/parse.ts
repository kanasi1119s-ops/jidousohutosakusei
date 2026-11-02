/** 全角数字・カンマ・「円」を許容して数値化する。空文字は NaN。 */
export function parseNumber(raw: string): number {
  const s = raw
    .normalize('NFKC')
    .replace(/[,\s円¥]/g, '')
    .replace(/[％%]$/, '')
  if (s === '') return NaN
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

export function formatYen(v: number): string {
  return Math.round(v).toLocaleString('ja-JP') + '円'
}
