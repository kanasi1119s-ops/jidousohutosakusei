export type RoundingMode = 'floor' | 'round' | 'ceil'
export type TaxRate = 10 | 8 | 0
export type PriceMode = 'exclusive' | 'inclusive'

export interface LineItem {
  id: string
  name: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface CalcOptions {
  priceMode: PriceMode
  rounding: RoundingMode
  withholding: boolean
}

export interface RateGroup {
  taxRate: TaxRate
  /** 税抜の対象額 */
  subtotalYen: number
  taxYen: number
  /** 税込の合計 */
  totalYen: number
}

export interface CalcResult {
  lineAmounts: number[]
  groups: RateGroup[]
  subtotalYen: number
  taxYen: number
  totalYen: number
  withholdingYen: number
  payableYen: number
}

export const MAX_UNIT_PRICE_YEN = 999_999_999
export const MAX_QUANTITY = 9999.999
export const MAX_ITEMS = 100

export const TAX_RATES: TaxRate[] = [10, 8, 0]

/**
 * 非負の整数 n を正の整数 d で割り、指定の端数処理で整数にする。
 * 浮動小数点の除算を避け、剰余で厳密に計算する（n は 2^53 未満の整数前提）。
 * 負数は絶対値で処理して符号を戻す（切り捨て＝0方向、切り上げ＝0から遠い方向）。
 */
export function roundDiv(n: number, d: number, mode: RoundingMode): number {
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const rem = abs % d
  const base = (abs - rem) / d
  let result: number
  if (rem === 0) {
    result = base
  } else if (mode === 'floor') {
    result = base
  } else if (mode === 'ceil') {
    result = base + 1
  } else {
    result = rem * 2 >= d ? base + 1 : base
  }
  return result === 0 ? 0 : sign * result
}

/** 明細1行の金額（円）。数量は小数3桁まで。 */
export function lineAmount(item: Pick<LineItem, 'quantity' | 'unitPriceYen'>, rounding: RoundingMode): number {
  const milliQty = Math.round(item.quantity * 1000)
  return roundDiv(milliQty * item.unitPriceYen, 1000, rounding)
}

/**
 * 源泉徴収税額（復興特別所得税込み）。報酬額（税抜）が100万円以下は10.21%、
 * 超える部分は20.42%。1円未満は切り捨て。
 */
export function withholdingTax(baseYen: number): number {
  const base = Math.max(0, baseYen)
  const limit = 1_000_000
  if (base <= limit) {
    return Math.floor((base * 1021) / 10000)
  }
  return Math.floor((limit * 1021 + (base - limit) * 2042) / 10000)
}

export function calculate(items: LineItem[], options: CalcOptions): CalcResult {
  const lineAmounts = items.map((it) => lineAmount(it, options.rounding))
  const groups: RateGroup[] = []
  for (const rate of TAX_RATES) {
    let sum = 0
    let used = false
    items.forEach((it, i) => {
      if (it.taxRate === rate) {
        sum += lineAmounts[i]
        used = true
      }
    })
    if (!used) continue
    // インボイス制度では、税率ごとに区分した合計に対し請求書1枚につき1回だけ端数処理する。
    if (options.priceMode === 'exclusive') {
      const taxYen = roundDiv(sum * rate, 100, options.rounding)
      groups.push({ taxRate: rate, subtotalYen: sum, taxYen, totalYen: sum + taxYen })
    } else {
      const taxYen = roundDiv(sum * rate, 100 + rate, options.rounding)
      groups.push({ taxRate: rate, subtotalYen: sum - taxYen, taxYen, totalYen: sum })
    }
  }
  const subtotalYen = groups.reduce((a, g) => a + g.subtotalYen, 0)
  const taxYen = groups.reduce((a, g) => a + g.taxYen, 0)
  const totalYen = subtotalYen + taxYen
  const withholdingYen = options.withholding ? withholdingTax(subtotalYen) : 0
  return {
    lineAmounts,
    groups,
    subtotalYen,
    taxYen,
    totalYen,
    withholdingYen,
    payableYen: totalYen - withholdingYen,
  }
}
