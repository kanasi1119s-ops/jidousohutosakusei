export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'

export interface Item {
  name: string
  qty: number
  unitPrice: number
  rate: TaxRate
}

export interface Issuer {
  name: string
  registrationNo: string
  address: string
  contact: string
  bank: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  customerName: string
  issuer: Issuer
  items: Item[]
  rounding: Rounding
  notes: string
}

export interface RateTotal {
  rate: TaxRate
  subtotal: number
  tax: number
}

export interface InvoiceTotals {
  lineAmounts: number[]
  byRate: RateTotal[]
  subtotal: number
  tax: number
  total: number
}

/** 全角数字・全角記号を半角にし、カンマと空白を除去して数値化する。不正なら NaN。 */
export function parseNumber(input: string): number {
  const half = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .replace(/[－−ー]/g, '-')
    .replace(/[,，\s]/g, '')
  if (half === '') return 0
  if (!/^-?\d+(\.\d+)?$/.test(half)) return NaN
  return Number(half)
}

export function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差（例: 0.1*3）を避けるため、小数第6位で丸めてから端数処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

/** 明細金額（税抜）。数量は小数可、金額は円単位に端数処理する。 */
export function lineAmount(item: Item, mode: Rounding): number {
  const v = item.unitPrice * item.qty
  return Number.isFinite(v) ? applyRounding(v, mode) : 0
}

/**
 * 適格請求書の税額計算: 税率ごとに区分した税抜合計に対し、1請求書につき税率ごとに1回だけ端数処理する。
 */
export function calcInvoice(items: Item[], mode: Rounding): InvoiceTotals {
  const lineAmounts = items.map((it) => lineAmount(it, mode))
  const byRate: RateTotal[] = ([10, 8] as TaxRate[])
    .map((rate) => {
      const subtotal = items.reduce((sum, it, i) => (it.rate === rate ? sum + lineAmounts[i] : sum), 0)
      return { rate, subtotal, tax: applyRounding((subtotal * rate) / 100, mode) }
    })
    .filter((r) => items.some((it) => it.rate === r.rate))
  const subtotal = byRate.reduce((s, r) => s + r.subtotal, 0)
  const tax = byRate.reduce((s, r) => s + r.tax, 0)
  return { lineAmounts, byRate, subtotal, tax, total: subtotal + tax }
}

export function isValidRegistrationNo(no: string): boolean {
  return /^T\d{13}$/.test(no)
}

export function validateInvoice(inv: Invoice): string[] {
  const w: string[] = []
  if (!inv.issuer.name.trim()) w.push('発行者の氏名または名称が未入力です。')
  if (inv.issuer.registrationNo.trim() === '') {
    w.push('登録番号が未入力です。登録番号がない請求書は適格請求書にはなりません。')
  } else if (!isValidRegistrationNo(inv.issuer.registrationNo.trim())) {
    w.push('登録番号は「T」+数字13桁の形式で入力してください（例: T1234567890123）。')
  }
  if (!inv.customerName.trim()) w.push('請求先の名称が未入力です。')
  if (!inv.issueDate) w.push('発行日（取引年月日）が未入力です。')
  if (inv.items.length === 0) w.push('明細が1件もありません。')
  inv.items.forEach((it, i) => {
    if (!it.name.trim()) w.push(`明細${i + 1}: 品名が未入力です。`)
    if (!Number.isFinite(it.qty) || !Number.isFinite(it.unitPrice)) {
      w.push(`明細${i + 1}: 数量または単価が数値として読み取れません。`)
    }
  })
  return w
}

export function newId(): string {
  return 'inv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export function emptyIssuer(): Issuer {
  return { name: '', registrationNo: '', address: '', contact: '', bank: '' }
}

export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function newInvoice(issuer: Issuer = emptyIssuer(), d: Date = new Date()): Invoice {
  return {
    id: newId(),
    number: '',
    issueDate: todayIso(d),
    dueDate: '',
    customerName: '',
    issuer: { ...issuer },
    items: [{ name: '', qty: 1, unitPrice: 0, rate: 10 }],
    rounding: 'floor',
    notes: '',
  }
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
