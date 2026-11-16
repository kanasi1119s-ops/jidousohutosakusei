export type TaxRate = 10 | 8 | 0
export type PriceMode = 'exclusive' | 'inclusive'
export type Rounding = 'floor' | 'round' | 'ceil'

export interface Item {
  name: string
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
  clientName: string
  issueDate: string
  dueDate: string
  subject: string
  items: Item[]
  priceMode: PriceMode
  rounding: Rounding
  withholding: boolean
  notes: string
  issuer: Issuer
}

export interface RateGroup {
  rate: TaxRate
  /** 明細金額の合計（priceMode に応じて税抜または税込） */
  subtotalYen: number
  netYen: number
  taxYen: number
  grossYen: number
}

export interface InvoiceTotals {
  groups: RateGroup[]
  netYen: number
  taxYen: number
  grossYen: number
  withholdingYen: number
  payableYen: number
}

export const TAX_RATES: TaxRate[] = [10, 8, 0]

/** 整数 n を d(>0) で割り、指定方式で整数に丸める。切り捨て=0方向、切り上げ=0から遠い方向、四捨五入=絶対値で判定 */
export function roundDiv(n: number, d: number, mode: Rounding): number {
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const q = Math.floor(abs / d)
  const r = abs - q * d
  let result = q
  if (mode === 'ceil') result = r > 0 ? q + 1 : q
  else if (mode === 'round') result = r * 2 >= d ? q + 1 : q
  return sign * result || 0
}

/** 数量は小数第3位まで扱い、浮動小数誤差を避けるため1000倍の整数で計算する */
export function lineAmount(item: Item, rounding: Rounding): number {
  const milli = Math.round(item.quantity * 1000)
  return roundDiv(milli * item.unitPriceYen, 1000, rounding)
}

/** 報酬・料金等に係る源泉徴収税額（復興特別所得税込み）。100万円以下は10.21%、超える部分は20.42%。1円未満切り捨て */
export function calcWithholding(baseYen: number): number {
  if (baseYen <= 0) return 0
  if (baseYen <= 1_000_000) return Math.floor((baseYen * 1021) / 10000)
  return 102_100 + Math.floor(((baseYen - 1_000_000) * 2042) / 10000)
}

/** 税率ごとに1回だけ端数処理を行う（品目ごとの端数処理はインボイス制度上認められない） */
export function computeInvoice(inv: Pick<Invoice, 'items' | 'priceMode' | 'rounding' | 'withholding'>): InvoiceTotals {
  const groups: RateGroup[] = []
  for (const rate of TAX_RATES) {
    const items = inv.items.filter((i) => i.taxRate === rate)
    if (items.length === 0) continue
    const subtotal = items.reduce((sum, i) => sum + lineAmount(i, inv.rounding), 0)
    if (inv.priceMode === 'exclusive') {
      const tax = roundDiv(subtotal * rate, 100, inv.rounding)
      groups.push({ rate, subtotalYen: subtotal, netYen: subtotal, taxYen: tax, grossYen: subtotal + tax })
    } else {
      const tax = roundDiv(subtotal * rate, 100 + rate, inv.rounding)
      groups.push({ rate, subtotalYen: subtotal, netYen: subtotal - tax, taxYen: tax, grossYen: subtotal })
    }
  }
  const netYen = groups.reduce((s, g) => s + g.netYen, 0)
  const taxYen = groups.reduce((s, g) => s + g.taxYen, 0)
  const grossYen = groups.reduce((s, g) => s + g.grossYen, 0)
  const withholdingYen = inv.withholding ? calcWithholding(netYen) : 0
  return { groups, netYen, taxYen, grossYen, withholdingYen, payableYen: grossYen - withholdingYen }
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export const REGISTRATION_PATTERN = /^T\d{13}$/

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateInvoice(inv: Invoice): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!inv.number.trim()) errors.push('請求番号を入力してください。')
  if (!inv.clientName.trim()) errors.push('請求先の名称を入力してください。')
  if (!inv.issuer.name.trim()) errors.push('発行者の名称を入力してください。')
  if (!isValidDate(inv.issueDate)) errors.push('発行日を正しい日付で入力してください。')
  if (inv.dueDate && !isValidDate(inv.dueDate)) errors.push('支払期限を正しい日付で入力してください。')
  if (inv.issuer.registrationNumber.trim()) {
    if (!REGISTRATION_PATTERN.test(inv.issuer.registrationNumber.trim())) {
      errors.push('登録番号は「T」＋数字13桁の形式で入力してください（例: T1234567890123）。')
    }
  } else {
    warnings.push('登録番号が未入力です。このままでは適格請求書の記載要件を満たしません（免税事業者の場合は通常の請求書として利用できます）。')
  }
  if (inv.items.length === 0) errors.push('明細を1行以上入力してください。')
  inv.items.forEach((it, idx) => {
    const n = idx + 1
    if (!it.name.trim()) errors.push(`明細${n}: 品名を入力してください。`)
    if (!Number.isFinite(it.quantity) || it.quantity === 0) errors.push(`明細${n}: 数量は0以外の数値で入力してください。`)
    else if (Math.abs(it.quantity) > 10_000) errors.push(`明細${n}: 数量は10,000以下で入力してください。`)
    if (!Number.isFinite(it.unitPriceYen) || !Number.isInteger(it.unitPriceYen)) {
      errors.push(`明細${n}: 単価は整数（円）で入力してください。`)
    } else if (Math.abs(it.unitPriceYen) > 100_000_000) errors.push(`明細${n}: 単価は1億円以下で入力してください。`)
    if (!TAX_RATES.includes(it.taxRate)) errors.push(`明細${n}: 税率が不正です。`)
  })
  return { errors, warnings }
}
