export type TaxRate = 10 | 8 | 0
export type Rounding = 'floor' | 'round' | 'ceil'
export type PriceMode = 'exclusive' | 'inclusive'
export type Honorific = '御中' | '様' | ''

export interface Item {
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface Party {
  name: string
  address: string
  registrationNumber: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  issuer: Party
  clientName: string
  honorific: Honorific
  items: Item[]
  priceMode: PriceMode
  rounding: Rounding
  notes: string
  bank: string
  updatedAt: number
}

export interface RateGroup {
  rate: TaxRate
  /** 税抜対象額（税込入力の場合は税込合計から税額を引いた額） */
  base: number
  tax: number
  /** 税率ごとの税込合計 */
  total: number
}

export interface Totals {
  lineAmounts: number[]
  groups: RateGroup[]
  subtotal: number
  tax: number
  total: number
}

export const MAX_ITEMS = 100
export const LIMIT = 1_000_000_000

const FULLWIDTH_OFFSET = 0xfee0

/** 全角数字・全角記号を半角に直し、カンマ・空白・円記号を除いて数値化する。解釈できなければ0。 */
export function normalizeNumber(input: string): number {
  const half = input
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/[ー－−―]/g, '-')
    .replace(/[,，\s¥￥円]/g, '')
  if (half === '' || !/^-?\d*\.?\d+$/.test(half)) return 0
  const n = Number(half)
  if (!Number.isFinite(n)) return 0
  return Math.max(-LIMIT, Math.min(LIMIT, n))
}

/** 絶対値に対して端数処理し、符号を戻す（値引き行でも向きが対称になる）。 */
export function applyRounding(value: number, mode: Rounding): number {
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  const r = mode === 'floor' ? Math.floor(abs) : mode === 'ceil' ? Math.ceil(abs) : Math.round(abs)
  return r === 0 ? 0 : sign * r
}

/**
 * 適格請求書の消費税額は「1請求書あたり税率ごとに1回」だけ端数処理する（国税庁Q&A）。
 * 行ごとに税額を端数処理して合算することはしない。
 * 行の金額（数量×単価）が円未満になる場合のみ、行金額を指定の端数処理で円単位にする。
 */
export function calcTotals(items: Item[], priceMode: PriceMode, rounding: Rounding): Totals {
  const lineAmounts = items.map((it) => applyRounding(it.quantity * it.unitPrice, rounding))
  const rates: TaxRate[] = [10, 8, 0]
  const groups: RateGroup[] = []
  for (const rate of rates) {
    const idx = items.map((it, i) => (it.taxRate === rate ? i : -1)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const sum = idx.reduce((acc, i) => acc + lineAmounts[i], 0)
    if (rate === 0) {
      groups.push({ rate, base: sum, tax: 0, total: sum })
    } else if (priceMode === 'exclusive') {
      const tax = applyRounding((sum * rate) / 100, rounding)
      groups.push({ rate, base: sum, tax, total: sum + tax })
    } else {
      const tax = applyRounding((sum * rate) / (100 + rate), rounding)
      groups.push({ rate, base: sum - tax, tax, total: sum })
    }
  }
  return {
    lineAmounts,
    groups,
    subtotal: groups.reduce((a, g) => a + g.base, 0),
    tax: groups.reduce((a, g) => a + g.tax, 0),
    total: groups.reduce((a, g) => a + g.total, 0),
  }
}

/** 登録番号（T＋数字13桁）を正規化する。全角・小文字・ハイフン混じりの入力を許容。 */
export function normalizeRegistrationNumber(input: string): string {
  return input
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/[\s-]/g, '')
    .toUpperCase()
}

export function isValidRegistrationNumber(input: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(input))
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + '¥' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatDateJa(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function newId(): string {
  const rnd = Math.random().toString(36).slice(2, 10)
  return `inv-${Date.now().toString(36)}-${rnd}`
}

export function newItem(): Item {
  return { name: '', quantity: 1, unitPrice: 0, taxRate: 10 }
}

export function newInvoice(issuer?: Party): Invoice {
  return {
    id: newId(),
    number: '',
    issueDate: todayIso(),
    dueDate: '',
    issuer: issuer ? { ...issuer } : { name: '', address: '', registrationNumber: '' },
    clientName: '',
    honorific: '御中',
    items: [newItem()],
    priceMode: 'exclusive',
    rounding: 'floor',
    notes: '',
    bank: '',
    updatedAt: Date.now(),
  }
}
