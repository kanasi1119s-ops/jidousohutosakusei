export type RoundingMode = 'floor' | 'round' | 'ceil'
export type TaxRate = 10 | 8 | 0

export interface Item {
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
  /** 軽減税率(8%)対象の場合 true（表示用の※印） */
}

export interface Invoice {
  id: string
  invoiceNo: string
  issueDate: string
  dueDate: string
  issuerName: string
  issuerAddress: string
  registrationNo: string
  clientName: string
  honorific: string
  items: Item[]
  rounding: RoundingMode
  note: string
  bankInfo: string
  updatedAt: string
}

export interface RateSummary {
  rate: TaxRate
  subtotal: number
  tax: number
}

export interface InvoiceTotals {
  byRate: RateSummary[]
  subtotal: number
  tax: number
  total: number
}

/** 全角数字・全角記号を半角に、カンマ・空白を除去する */
export function normalizeNumberText(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー]/g, '-')
    .replace(/[．]/g, '.')
    .replace(/[,，、\s　]/g, '')
}

export function parseNumber(s: string): number {
  const n = Number(normalizeNumberText(s))
  return Number.isFinite(n) ? n : 0
}

export function applyRounding(value: number, mode: RoundingMode): number {
  // 浮動小数点誤差対策: 小数第6位で丸めてから端数処理
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return Math.round(v)
}

export function lineAmount(item: Item): number {
  // 明細金額は円未満を切り捨て（税抜）
  return Math.floor(Math.round(item.quantity * item.unitPrice * 1e6) / 1e6)
}

/**
 * 適格請求書では税率ごとに区分した合計額に対する消費税額を、1請求書につき税率ごとに
 * 1回だけ端数処理して計算する（明細ごとの端数処理は不可）。
 */
export function calcTotals(items: Item[], rounding: RoundingMode): InvoiceTotals {
  const rates: TaxRate[] = [10, 8, 0]
  const byRate: RateSummary[] = []
  for (const rate of rates) {
    const targets = items.filter((i) => i.taxRate === rate)
    if (targets.length === 0) continue
    const subtotal = targets.reduce((sum, i) => sum + lineAmount(i), 0)
    byRate.push({ rate, subtotal, tax: applyRounding((subtotal * rate) / 100, rounding) })
  }
  const subtotal = byRate.reduce((s, r) => s + r.subtotal, 0)
  const tax = byRate.reduce((s, r) => s + r.tax, 0)
  return { byRate, subtotal, tax, total: subtotal + tax }
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP')
}

/** 適格請求書発行事業者の登録番号: 「T」+13桁の数字 */
export function isValidRegistrationNo(s: string): boolean {
  return /^T\d{13}$/.test(s)
}

export function normalizeRegistrationNo(s: string): string {
  const t = normalizeNumberText(s.replace(/[Ｔｔt]/g, 'T').replace(/[-]/g, ''))
  return t.replace(/-/g, '')
}

export interface ValidationIssue {
  field: string
  message: string
}

/** 適格請求書の必須記載事項の簡易チェック（法的な保証ではない） */
export function validateInvoice(inv: Invoice): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!inv.issuerName.trim()) issues.push({ field: 'issuerName', message: '発行者の氏名または名称が未入力です' })
  if (!inv.registrationNo.trim()) {
    issues.push({ field: 'registrationNo', message: '登録番号（T+13桁）が未入力です。未入力のまま発行すると適格請求書にはなりません' })
  } else if (!isValidRegistrationNo(inv.registrationNo)) {
    issues.push({ field: 'registrationNo', message: '登録番号は「T」+13桁の数字で入力してください' })
  }
  if (!inv.clientName.trim()) issues.push({ field: 'clientName', message: '宛名が未入力です' })
  if (!inv.issueDate) issues.push({ field: 'issueDate', message: '発行日（取引年月日）が未入力です' })
  if (inv.items.filter((i) => i.name.trim()).length === 0) {
    issues.push({ field: 'items', message: '明細（品目）が1件もありません' })
  }
  if (inv.items.some((i) => i.taxRate === 8)) {
    // 軽減税率の対象品目であることの明示は ※ 印で行う（表示側で付与）
  }
  return issues
}
