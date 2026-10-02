/** 全角数字・全角記号を半角へ寄せる（金額・登録番号入力用） */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，、]/g, ',')
    .replace(/．/g, '.')
    .replace(/[－ー−‐]/g, '-')
    .replace(/　/g, ' ')
}

/** 数値入力のパース。不正・負数・巨大値は0扱い（上限は安全な範囲に制限） */
export function parseNumber(s: string, max = 1e9): number {
  const t = toHalfWidth(s).replace(/[,\s]/g, '')
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return 0
  const n = Number(t)
  if (!Number.isFinite(n)) return 0
  return Math.min(n, max)
}

/** 適格請求書発行事業者の登録番号: T + 13桁の数字（形式のみ検証。実在確認は国税庁公表サイトで行う） */
export function normalizeRegistrationNumber(s: string): string {
  const t = toHalfWidth(s).toUpperCase().replace(/[\s-]/g, '')
  return t
}
export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(s))
}

export function formatYen(n: number): string {
  return '¥' + Math.trunc(n).toLocaleString('ja-JP')
}
