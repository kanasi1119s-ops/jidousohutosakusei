export type TaxRate = 10 | 8
export type TaxMode = 'exclusive' | 'inclusive'
export type Rounding = 'floor' | 'round' | 'ceil'
export type DocKind = 'invoice' | 'quote'

export interface Item {
  name: string
  qty: number
  unitPrice: number
  taxRate: TaxRate
}

export interface Party {
  name: string
  address: string
  registrationNumber: string
}

export interface InvoiceDoc {
  kind: DocKind
  number: string
  issueDate: string
  dueDate: string
  issuer: Party
  clientName: string
  items: Item[]
  taxMode: TaxMode
  rounding: Rounding
  bank: string
  notes: string
}

export interface RateTotal {
  rate: TaxRate
  subtotal: number
  tax: number
}

export interface Totals {
  lineAmounts: number[]
  byRate: RateTotal[]
  subtotal: number
  tax: number
  total: number
}

/** 全角数字・全角記号を半角へ（入力ゆれ対策）。 */
export function normalizeNumberText(text: string): string {
  return text.normalize('NFKC').replace(/[,，\s円¥￥]/g, '')
}

export function parseNumber(text: string): number {
  const t = normalizeNumberText(text)
  if (t === '') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export function applyRounding(value: number, mode: Rounding): number {
  // 浮動小数点誤差（例: 0.1*3）で端数が狂わないよう、微小値を丸めてから端数処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function normalizeRegistrationNumber(text: string): string {
  return text.normalize('NFKC').replace(/[\s-]/g, '').toUpperCase()
}

/** 適格請求書発行事業者の登録番号は「T + 13桁の数字」。形式のみ検査する（実在確認は国税庁サイトで行う）。 */
export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}

/**
 * 適格請求書の税額は「1書類につき税率ごとに1回」端数処理する。
 * 明細ごとの端数処理は金額（税抜／税込）のみに適用し、税額は税率ごとの合計から算出する。
 */
export function calculate(doc: Pick<InvoiceDoc, 'items' | 'taxMode' | 'rounding'>): Totals {
  const lineAmounts = doc.items.map((it) =>
    applyRounding((Number(it.qty) || 0) * (Number(it.unitPrice) || 0), doc.rounding),
  )
  const rates: TaxRate[] = [10, 8]
  const byRate: RateTotal[] = []
  for (const rate of rates) {
    let subtotal = 0
    let used = false
    doc.items.forEach((it, i) => {
      if (it.taxRate === rate) {
        subtotal += lineAmounts[i]
        used = true
      }
    })
    if (!used) continue
    const tax =
      doc.taxMode === 'exclusive'
        ? applyRounding((subtotal * rate) / 100, doc.rounding)
        : applyRounding((subtotal * rate) / (100 + rate), doc.rounding)
    byRate.push({ rate, subtotal, tax })
  }
  const sum = byRate.reduce((a, r) => a + r.subtotal, 0)
  const tax = byRate.reduce((a, r) => a + r.tax, 0)
  return {
    lineAmounts,
    byRate,
    subtotal: doc.taxMode === 'exclusive' ? sum : sum - tax,
    tax,
    total: doc.taxMode === 'exclusive' ? sum + tax : sum,
  }
}

export function validateDoc(doc: InvoiceDoc): string[] {
  const errors: string[] = []
  if (!doc.issuer.name.trim()) errors.push('発行者名を入力してください。')
  if (!doc.clientName.trim()) errors.push('宛名を入力してください。')
  if (doc.kind === 'invoice' && doc.issuer.registrationNumber.trim() && !isValidRegistrationNumber(doc.issuer.registrationNumber)) {
    errors.push('登録番号は「T」+数字13桁の形式で入力してください（例: T1234567890123）。')
  }
  if (doc.items.length === 0) errors.push('明細を1行以上入力してください。')
  doc.items.forEach((it, i) => {
    if (!it.name.trim()) errors.push(`明細${i + 1}: 品名を入力してください。`)
    if (!(it.qty >= 0) || !Number.isFinite(it.qty)) errors.push(`明細${i + 1}: 数量は0以上の数値で入力してください。`)
    if (!Number.isFinite(it.unitPrice)) errors.push(`明細${i + 1}: 単価は数値で入力してください。`)
  })
  return errors
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}
