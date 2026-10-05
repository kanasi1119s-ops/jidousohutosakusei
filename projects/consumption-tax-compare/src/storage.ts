import { SUPPORTED_YEARS } from './rules'
import { emptyInput, type TaxInput } from './calc'

const STORAGE_KEY = 'consumption-tax-compare:input:v1'

function isNumArray6(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === 6 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
}

/** 任意の値を TaxInput として検証する。不正なら Error を投げる */
export function parseInput(parsed: unknown): TaxInput {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  const o = parsed as Record<string, unknown>
  if (typeof o.year !== 'number' || !(SUPPORTED_YEARS as readonly number[]).includes(o.year)) {
    throw new Error('インポートしたファイルの形式が不正です（year が対応外です）。')
  }
  if (typeof o.convertedFromExempt !== 'boolean') {
    throw new Error('インポートしたファイルの形式が不正です（convertedFromExempt が真偽値ではありません）。')
  }
  const numKeys = ['baseYearSalesYen', 'purchases10', 'purchases8', 'exemptPurchasesFirst', 'exemptPurchasesSecond']
  for (const k of numKeys) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k] as number)) {
      throw new Error(`インポートしたファイルの形式が不正です（${k} が数値ではありません）。`)
    }
  }
  if (!isNumArray6(o.sales10) || !isNumArray6(o.sales8)) {
    throw new Error('インポートしたファイルの形式が不正です（sales10 / sales8 は6要素の数値配列が必要です）。')
  }
  return {
    ...emptyInput(),
    year: o.year as TaxInput['year'],
    convertedFromExempt: o.convertedFromExempt,
    baseYearSalesYen: o.baseYearSalesYen as number,
    purchases10: o.purchases10 as number,
    purchases8: o.purchases8 as number,
    exemptPurchasesFirst: o.exemptPurchasesFirst as number,
    exemptPurchasesSecond: o.exemptPurchasesSecond as number,
    sales10: [...(o.sales10 as number[])],
    sales8: [...(o.sales8 as number[])],
  }
}

export function parseInputFromJsonText(text: string): TaxInput {
  // 先頭にBOMが付いたJSONも受け付ける
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み取れません。')
  }
  return parseInput(parsed)
}

export function saveInput(input: TaxInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージが使えない環境（プライベートモード等）でも致命的にしない
  }
}

export function loadInput(): TaxInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseInput(JSON.parse(raw))
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: TaxInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}
