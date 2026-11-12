// 請求書の計算・検証ロジック（DOM非依存）。
// 適格請求書の端数処理ルール: 消費税額の端数処理は「1請求書につき税率ごとに1回」。

export type TaxRate = 10 | 8
export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface LineItem {
  description: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface Issuer {
  name: string
  registrationNumber: string
  address: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD または空
  qualified: boolean // 適格請求書（登録番号を記載）として発行するか
  issuer: Issuer
  clientName: string
  items: LineItem[]
  rounding: RoundingMode
  notes: string
  updatedAt: string
}

export interface TaxGroup {
  rate: TaxRate
  subtotalYen: number // 税抜合計
  taxYen: number // 消費税額
  totalYen: number // 税込合計
}

export interface Totals {
  lineAmounts: number[]
  groups: TaxGroup[]
  subtotalYen: number
  taxYen: number
  totalYen: number
}

export const MAX_UNIT_PRICE_YEN = 10_000_000_000
export const MAX_QUANTITY = 1_000_000

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** 明細行の金額（税抜）。1円未満は切り捨て。無効な値は0として扱う。 */
export function lineAmount(item: LineItem): number {
  if (!isFiniteNumber(item.quantity) || !isFiniteNumber(item.unitPriceYen)) return 0
  return Math.floor(item.quantity * item.unitPriceYen + 1e-6)
}

/** 税額 = 税抜合計 × 税率 を指定方式で1円単位に丸める（整数演算で誤差を避ける）。 */
export function roundTax(subtotalYen: number, rate: number, mode: RoundingMode): number {
  const numerator = subtotalYen * rate
  if (mode === 'floor') return Math.floor(numerator / 100)
  if (mode === 'ceil') return Math.ceil(numerator / 100)
  return Math.floor((numerator + 50) / 100)
}

export function computeTotals(items: LineItem[], mode: RoundingMode): Totals {
  const lineAmounts = items.map(lineAmount)
  const groups: TaxGroup[] = []
  for (const rate of [10, 8] as const) {
    const idx = items.map((it, i) => (it.taxRate === rate ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const subtotalYen = idx.reduce((sum, i) => sum + lineAmounts[i], 0)
    const taxYen = roundTax(subtotalYen, rate, mode)
    groups.push({ rate, subtotalYen, taxYen, totalYen: subtotalYen + taxYen })
  }
  const subtotalYen = groups.reduce((s, g) => s + g.subtotalYen, 0)
  const taxYen = groups.reduce((s, g) => s + g.taxYen, 0)
  return { lineAmounts, groups, subtotalYen, taxYen, totalYen: subtotalYen + taxYen }
}

export function validateInvoice(inv: Invoice): string[] {
  const errors: string[] = []
  if (inv.number.trim() === '') errors.push('請求書番号を入力してください。')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate)) errors.push('発行日を入力してください。')
  if (inv.dueDate !== '' && /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate) && inv.dueDate < inv.issueDate) {
    errors.push('支払期限が発行日より前になっています。')
  }
  if (inv.issuer.name.trim() === '') errors.push('発行者（自社）名を入力してください。')
  if (inv.clientName.trim() === '') errors.push('請求先名を入力してください。')
  if (inv.qualified && !isValidRegistrationNumber(inv.issuer.registrationNumber)) {
    errors.push('適格請求書として発行する場合、登録番号は「T」＋数字13桁で入力してください。')
  }
  if (inv.items.length === 0) errors.push('明細を1件以上入力してください。')
  inv.items.forEach((it, i) => {
    const n = i + 1
    if (it.description.trim() === '') errors.push(`明細${n}: 品目を入力してください。`)
    if (!isFiniteNumber(it.quantity) || it.quantity <= 0 || it.quantity > MAX_QUANTITY) {
      errors.push(`明細${n}: 数量は0より大きく${MAX_QUANTITY.toLocaleString('en-US')}以下の数値で入力してください。`)
    }
    if (
      !isFiniteNumber(it.unitPriceYen) ||
      !Number.isInteger(it.unitPriceYen) ||
      it.unitPriceYen < 0 ||
      it.unitPriceYen > MAX_UNIT_PRICE_YEN
    ) {
      errors.push(`明細${n}: 単価は0以上の整数（円）で入力してください。`)
    }
  })
  return errors
}

// ---- 文字列の正規化 ----

/** 全角数字・全角記号・カンマ・空白を正規化して数値化する。数値でなければ null。 */
export function parseNumber(text: string): number | null {
  const t = text
    .normalize('NFKC')
    .replace(/[,\s]/g, '')
    .replace(/[−ー‐]/g, '-')
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

export function normalizeRegistrationNumber(text: string): string {
  return text.normalize('NFKC').replace(/[\s-]/g, '').toUpperCase()
}

export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}

/** 既存の請求書番号から次の番号を提案する（末尾の数字を+1、桁数維持）。 */
export function nextInvoiceNumber(existing: string[]): string {
  let best: { prefix: string; n: number; width: number } | null = null
  for (const s of existing) {
    const m = /^(.*?)(\d+)$/.exec(s.trim())
    if (!m) continue
    const n = Number(m[2])
    if (best === null || n >= best.n) best = { prefix: m[1], n, width: m[2].length }
  }
  if (best === null) return 'INV-0001'
  return best.prefix + String(best.n + 1).padStart(best.width, '0')
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '¥' + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function emptyIssuer(): Issuer {
  return { name: '', registrationNumber: '', address: '', bank: '' }
}
