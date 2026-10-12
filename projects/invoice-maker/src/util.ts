/** 全角数字・カンマ・「円」・空白を許容して数値に変換する。解釈できなければ NaN。 */
export function parseNumberInput(text: string): number {
  const s = text
    .normalize('NFKC')
    .replace(/[,\s円¥]/g, '')
    .replace(/^[−ー－]/, '-')
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

export function formatYen(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toLocaleString('ja-JP')}円`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP', { maximumFractionDigits: 3 })
}

/** 登録番号を正規化する（全角→半角、空白・ハイフン除去、大文字化）。 */
export function normalizeRegistrationNumber(text: string): string {
  return text.normalize('NFKC').replace(/[\s-]/g, '').toUpperCase()
}

/** 適格請求書発行事業者の登録番号形式: 「T」+ 数字13桁。 */
export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}

/** ダウンロードファイル名用に英数字・ハイフン・アンダースコアのみへ変換する。 */
export function sanitizeFileNamePart(text: string, fallback = 'invoice'): string {
  const s = text
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return s === '' ? fallback : s.slice(0, 40)
}

export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 2026-10-12 → 2026年10月12日。形式が不正なら空文字。 */
export function formatDateJa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
}

/** 請求書番号の末尾の数字を1つ進める（例: INV-001 → INV-002）。数字がなければ -2 を付ける。 */
export function bumpInvoiceNumber(num: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(num)
  if (!m) return num === '' ? '' : `${num}-2`
  const next = String(Number(m[2]) + 1).padStart(m[2].length, '0')
  return `${m[1]}${next}${m[3]}`
}

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
