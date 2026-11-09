export type Rate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'

export interface Item {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  rate: Rate
}

export interface Issuer {
  name: string
  registrationNumber: string
  address: string
  contact: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  issuer: Issuer
  customerName: string
  items: Item[]
  priceMode: PriceMode
  rounding: Rounding
  note: string
  savedAt: string
}

export interface RateTotal {
  rate: Rate
  /** 税抜の対価の額 */
  base: number
  /** 消費税額（税率ごとに1回だけ端数処理） */
  tax: number
  /** 税込の対価の額 */
  gross: number
}

export interface Calculation {
  lineAmounts: number[]
  byRate: RateTotal[]
  base: number
  tax: number
  gross: number
}

/** 整数 numer / denom を端数処理して整数にする。負数は絶対値に対して処理（0方向への切り捨て）。 */
export function roundDiv(numer: number, denom: number, mode: Rounding): number {
  if (denom <= 0) throw new Error('denom must be positive')
  const sign = numer < 0 ? -1 : 1
  const n = Math.abs(numer)
  const q = Math.floor(n / denom)
  const r = n - q * denom
  let result: number
  if (r === 0) result = q
  else if (mode === 'floor') result = q
  else if (mode === 'ceil') result = q + 1
  else result = r * 2 >= denom ? q + 1 : q
  return result === 0 ? 0 : sign * result
}

/** 明細金額 = 数量 × 単価（数量は小数3桁まで扱う） */
export function lineAmount(item: Item, mode: Rounding): number {
  const qtyMilli = Math.round(item.quantity * 1000)
  return roundDiv(qtyMilli * Math.round(item.unitPrice), 1000, mode)
}

export function calculate(items: Item[], priceMode: PriceMode, mode: Rounding): Calculation {
  const lineAmounts = items.map((it) => lineAmount(it, mode))
  const sums = new Map<Rate, number>()
  items.forEach((it, i) => sums.set(it.rate, (sums.get(it.rate) ?? 0) + lineAmounts[i]))

  const byRate: RateTotal[] = []
  for (const rate of [10, 8] as Rate[]) {
    if (!sums.has(rate)) continue
    const sum = sums.get(rate) as number
    if (priceMode === 'exclusive') {
      const tax = roundDiv(sum * rate, 100, mode)
      byRate.push({ rate, base: sum, tax, gross: sum + tax })
    } else {
      const tax = roundDiv(sum * rate, 100 + rate, mode)
      byRate.push({ rate, base: sum - tax, tax, gross: sum })
    }
  }
  const base = byRate.reduce((a, r) => a + r.base, 0)
  const tax = byRate.reduce((a, r) => a + r.tax, 0)
  return { lineAmounts, byRate, base, tax, gross: base + tax }
}

/** 全角数字・全角記号・カンマを正規化して数値化。不正なら NaN。 */
export function parseNumber(text: string): number {
  const half = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー‐]/g, '-')
    .replace(/[．]/g, '.')
    .replace(/[，、]/g, ',')
    .replace(/[,\s]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

/** 登録番号の正規化（全角→半角、前後空白除去、小文字t→大文字T） */
export function normalizeRegistrationNumber(text: string): string {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s-]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(text)
}

export function isValidDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const d = new Date(text + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export function validateInvoice(inv: Pick<Invoice, 'number' | 'issueDate' | 'dueDate' | 'issuer' | 'customerName' | 'items'>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!inv.number.trim()) errors.push('請求書番号を入力してください。')
  if (!isValidDate(inv.issueDate)) errors.push('発行日（取引年月日）を正しく入力してください。')
  if (inv.dueDate && !isValidDate(inv.dueDate)) errors.push('支払期限の日付が正しくありません。')
  if (!inv.customerName.trim()) errors.push('宛名（取引先の氏名又は名称）を入力してください。')
  if (!inv.issuer.name.trim()) errors.push('発行者の氏名又は名称を入力してください。')
  if (inv.items.length === 0) errors.push('明細を1行以上入力してください。')
  inv.items.forEach((it, i) => {
    if (!it.name.trim()) errors.push(`明細${i + 1}行目: 品名を入力してください。`)
    if (!Number.isFinite(it.quantity) || it.quantity === 0) errors.push(`明細${i + 1}行目: 数量は0以外の数値を入力してください。`)
    if (!Number.isFinite(it.unitPrice)) errors.push(`明細${i + 1}行目: 単価を数値で入力してください。`)
    if (Number.isFinite(it.quantity) && it.quantity !== Math.round(it.quantity * 1000) / 1000)
      errors.push(`明細${i + 1}行目: 数量は小数第3位までです。`)
  })
  const reg = inv.issuer.registrationNumber
  if (!reg) {
    warnings.push('登録番号が未入力です。適格請求書（インボイス）の記載事項を満たしません（免税事業者などの場合は区分記載請求書相当）。')
  } else if (!isValidRegistrationNumber(reg)) {
    errors.push('登録番号は「T」+数字13桁の形式で入力してください（例: T1234567890123）。')
  }
  return { errors, warnings }
}
