export type TaxRate = 10 | 8 | 0
export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface LineItem {
  name: string
  quantity: number
  unitPriceYen: number // 税抜単価
  taxRate: TaxRate
}

export interface RateSummary {
  rate: TaxRate
  subtotalYen: number // 税抜小計
  taxYen: number // 消費税額
}

export interface InvoiceTotals {
  lineAmounts: number[]
  byRate: RateSummary[]
  subtotalYen: number
  taxYen: number
  totalYen: number
}

const FULLWIDTH_OFFSET = 0xfee0

/** 全角数字・全角記号を半角にし、カンマ・空白を除去する */
export function normalizeNumberText(text: string): string {
  return text
    .replace(/[０-９．－＋]/g, (c) => String.fromCharCode(c.charCodeAt(0) - FULLWIDTH_OFFSET))
    .replace(/[ー−―]/g, '-')
    .replace(/[,，、\s　]/g, '')
}

/** 数値として解釈できなければ null */
export function parseNumber(text: string): number | null {
  const t = normalizeNumberText(text)
  if (t === '' || !/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function applyRounding(value: number, mode: RoundingMode): number {
  // 浮動小数点誤差(例: 0.1+0.2)による端数ずれを避けるため、小数第6位で丸めてから端数処理する
  const v = Math.round(value * 1e6) / 1e6
  if (mode === 'floor') return Math.floor(v)
  if (mode === 'ceil') return Math.ceil(v)
  return v < 0 ? -Math.round(-v) : Math.round(v)
}

/** 明細金額(税抜) = 数量 × 単価。1円未満は端数処理設定に従う */
export function lineAmount(item: LineItem, mode: RoundingMode): number {
  return applyRounding(item.quantity * item.unitPriceYen, mode)
}

/**
 * 適格請求書の端数処理は「税率ごとに区分した合計額に対して、1請求書につき税率ごとに1回」
 * 行う必要がある。そのため明細ごとではなく税率別の小計に対して消費税額を算出する。
 */
export function calcTotals(items: LineItem[], mode: RoundingMode): InvoiceTotals {
  const lineAmounts = items.map((it) => lineAmount(it, mode))
  const rates: TaxRate[] = [10, 8, 0]
  const byRate: RateSummary[] = rates
    .map((rate) => {
      let subtotal = 0
      items.forEach((it, i) => {
        if (it.taxRate === rate) subtotal += lineAmounts[i]
      })
      const used = items.some((it) => it.taxRate === rate)
      return { rate, subtotalYen: subtotal, taxYen: applyRounding((subtotal * rate) / 100, mode), used }
    })
    .filter((r) => r.used)
    .map(({ rate, subtotalYen, taxYen }) => ({ rate, subtotalYen, taxYen }))
  const subtotalYen = byRate.reduce((s, r) => s + r.subtotalYen, 0)
  const taxYen = byRate.reduce((s, r) => s + r.taxYen, 0)
  return { lineAmounts, byRate, subtotalYen, taxYen, totalYen: subtotalYen + taxYen }
}

/** 登録番号を正規化（全角→半角、ハイフン・空白除去、先頭tを大文字化） */
export function normalizeRegistrationNumber(text: string): string {
  return normalizeNumberText(text.replace(/[Ｔｔ]/g, 'T')).replace(/-/g, '').replace(/^t/, 'T')
}

/** 適格請求書発行事業者の登録番号形式: 「T」+数字13桁（国税庁での実在確認は別途必要） */
export function isValidRegistrationNumber(text: string): boolean {
  return /^T\d{13}$/.test(normalizeRegistrationNumber(text))
}

export function formatYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}${Math.abs(n).toLocaleString('ja-JP')}円`
}
