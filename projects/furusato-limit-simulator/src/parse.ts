/** 全角数字・カンマ・円記号を除去して数値化する。空欄は null、解釈不能は NaN。 */
export function parseNumberField(text: string): number | null {
  const half = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，、円¥\s]/g, '')
  if (half === '') return null
  return /^\d+(\.\d+)?$/.test(half) ? Number(half) : NaN
}
