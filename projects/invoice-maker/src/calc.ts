// 請求書の金額計算（すべて整数演算。浮動小数点誤差を避ける）

export type Rounding = 'floor' | 'round' | 'ceil'
export type TaxRate = 10 | 8 | 0

export interface LineItem {
  name: string
  qty: number // 小数3桁まで
  unitPrice: number // 税抜単価（円、整数）
  taxRate: TaxRate
}

export const MAX_QTY = 9999
export const MAX_UNIT_PRICE = 99_999_999
export const MAX_ITEMS = 100
/** 1請求書あたりの税抜絶対値合計の上限（整数演算が安全整数に収まることを保証する） */
export const MAX_SUBTOTAL = 10_000_000_000

/** 全角数字・全角記号・カンマ・空白を正規化して数値化する。不正なら NaN。 */
export function parseNumberLoose(input: string): number {
  const s = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[−ー－‐―]/g, '-')
    .replace(/[,，、\s　]/g, '')
  if (s === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return NaN
  return Number(s)
}

/** 非負整数 n を d で割り、端数処理する。負数は絶対値で処理して符号を戻す（0方向への丸め）。 */
export function divRound(n: number, d: number, mode: Rounding): number {
  const sign = n < 0 ? -1 : 1
  const a = Math.abs(n)
  const q = Math.floor(a / d)
  const r = a - q * d
  let res = q
  if (r !== 0) {
    if (mode === 'ceil') res = q + 1
    else if (mode === 'round' && r * 2 >= d) res = q + 1
  }
  return res === 0 ? 0 : sign * res
}

export function lineAmount(item: LineItem, rounding: Rounding): number {
  const qtyMilli = Math.round(item.qty * 1000)
  return divRound(Math.round(item.unitPrice) * qtyMilli, 1000, rounding)
}

export interface TaxGroup {
  rate: TaxRate
  subtotal: number // 税抜
  tax: number
}

export interface InvoiceTotals {
  amounts: number[]
  groups: TaxGroup[]
  subtotal: number
  tax: number
  withholding: number
  total: number // 請求金額（税込 − 源泉徴収）
  grossTotal: number // 税込合計
}

/** 源泉徴収税額（報酬・料金等）。100万円以下は10.21%、超過分は20.42%。1円未満切捨て。 */
export function withholdingTax(base: number): number {
  if (base <= 0) return 0
  if (base <= 1_000_000) return Math.floor((base * 1021) / 10000)
  return Math.floor((1_000_000 * 1021 + (base - 1_000_000) * 2042) / 10000)
}

export function computeInvoice(
  items: LineItem[],
  rounding: Rounding,
  withholding: boolean,
): InvoiceTotals {
  const amounts = items.map((it) => lineAmount(it, rounding))
  const order: TaxRate[] = [10, 8, 0]
  const groups: TaxGroup[] = []
  for (const rate of order) {
    const idx = items.map((it, i) => (it.taxRate === rate ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const subtotal = idx.reduce((s, i) => s + amounts[i], 0)
    // 適格請求書では「税率ごとに1回」の端数処理
    const tax = rate === 0 ? 0 : divRound(subtotal * rate, 100, rounding)
    groups.push({ rate, subtotal, tax })
  }
  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0)
  const tax = groups.reduce((s, g) => s + g.tax, 0)
  const grossTotal = subtotal + tax
  const wh = withholding ? withholdingTax(subtotal) : 0
  return { amounts, groups, subtotal, tax, withholding: wh, total: grossTotal - wh, grossTotal }
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '¥' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export interface ItemIssue {
  index: number
  message: string
}

export function validateItems(items: LineItem[]): ItemIssue[] {
  const issues: ItemIssue[] = []
  if (items.length === 0) issues.push({ index: -1, message: '明細を1行以上入力してください。' })
  if (items.length > MAX_ITEMS)
    issues.push({ index: -1, message: `明細は${MAX_ITEMS}行までです。` })
  items.forEach((it, i) => {
    const n = i + 1
    if (it.name.trim() === '') issues.push({ index: i, message: `明細${n}行目: 品名を入力してください。` })
    if (!Number.isFinite(it.qty) || it.qty < 0 || it.qty > MAX_QTY)
      issues.push({ index: i, message: `明細${n}行目: 数量は0〜${MAX_QTY}で入力してください。` })
    else if (Math.abs(it.qty * 1000 - Math.round(it.qty * 1000)) > 1e-6)
      issues.push({ index: i, message: `明細${n}行目: 数量は小数第3位までです。` })
    if (
      !Number.isFinite(it.unitPrice) ||
      !Number.isInteger(it.unitPrice) ||
      Math.abs(it.unitPrice) > MAX_UNIT_PRICE
    )
      issues.push({
        index: i,
        message: `明細${n}行目: 単価は整数（円）で、絶対値${MAX_UNIT_PRICE.toLocaleString('en-US')}以下にしてください。`,
      })
  })
  if (issues.length === 0) {
    const absSum = items.reduce((sum, it) => sum + Math.abs(lineAmount(it, 'ceil')), 0)
    if (absSum > MAX_SUBTOTAL)
      issues.push({ index: -1, message: `1枚の請求書の税抜合計は${MAX_SUBTOTAL.toLocaleString('en-US')}円までです。` })
  }
  return issues
}

/** 適格請求書発行事業者の登録番号: T + 数字13桁 */
export function isValidRegistrationNumber(s: string): boolean {
  return /^T\d{13}$/.test(s)
}

/** 全角を半角にして大文字化・空白除去（登録番号の入力補助） */
export function normalizeRegistrationNumber(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　-]/g, '')
    .toUpperCase()
}
