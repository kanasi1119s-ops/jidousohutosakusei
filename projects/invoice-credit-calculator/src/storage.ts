import { isValidDate, MAX_AMOUNT_YEN, type Purchase, type Rounding } from './calc'

const STORAGE_KEY = 'invoice-credit-calculator:state:v1'

export interface AppState {
  version: 1
  rounding: Rounding
  purchases: Purchase[]
}

export const EMPTY_STATE: AppState = { version: 1, rounding: 'floor', purchases: [] }

function isPurchase(p: unknown): p is Purchase {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.date === 'string' &&
    isValidDate(o.date) &&
    typeof o.supplier === 'string' &&
    typeof o.amountYen === 'number' &&
    Number.isSafeInteger(o.amountYen) &&
    o.amountYen >= 0 &&
    o.amountYen <= MAX_AMOUNT_YEN &&
    (o.taxRate === 10 || o.taxRate === 8) &&
    (o.supplierType === 'qualified' || o.supplierType === 'unqualified')
  )
}

export function parseState(text: string): AppState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み込めません。')
  }
  const o = parsed as Record<string, unknown>
  if (typeof o !== 'object' || o === null || !Array.isArray(o.purchases)) {
    throw new Error('インポートしたファイルの形式が不正です（purchases が配列ではありません）。')
  }
  const bad = o.purchases.findIndex((p) => !isPurchase(p))
  if (bad >= 0) throw new Error(`インポートしたファイルの形式が不正です（${bad + 1}件目の仕入データ）。`)
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return { version: 1, rounding, purchases: o.purchases as Purchase[] }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ストレージ使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseState(raw) : null
  } catch {
    return null
  }
}

export function stateToJsonBlob(state: AppState): Blob {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' })
}
