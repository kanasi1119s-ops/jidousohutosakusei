import type { CompareInput } from './calc'

const STORAGE_KEY = 'invoice-tax-compare:input:v1'

const NUMBER_KEYS = [
  'taxYear',
  'baseSalesYen',
  'sales10Yen',
  'sales8Yen',
  'purchases10Yen',
  'purchases8Yen',
  'exemptPurchases10Yen',
  'exemptPurchases8Yen',
  'exemptCreditPercent',
  'simplifiedCategory',
] as const
const BOOL_KEYS = ['wasExempt', 'simplifiedFiled'] as const

export function parseInputFromJsonText(text: string): CompareInput {
  const parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  for (const key of NUMBER_KEYS) {
    if (typeof parsed[key] !== 'number') {
      throw new Error(`インポートしたファイルの形式が不正です（${key} が数値ではありません）。`)
    }
  }
  for (const key of BOOL_KEYS) {
    if (typeof parsed[key] !== 'boolean') {
      throw new Error(`インポートしたファイルの形式が不正です（${key} が真偽値ではありません）。`)
    }
  }
  const result = {} as Record<string, number | boolean>
  for (const key of NUMBER_KEYS) result[key] = parsed[key]
  for (const key of BOOL_KEYS) result[key] = parsed[key]
  return result as unknown as CompareInput
}

export function saveInput(input: CompareInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージが使えない環境（プライベートモード等）でも致命的にしない
  }
}

export function loadInput(): CompareInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseInputFromJsonText(raw) : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: CompareInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}
