import type { SimulatorInput, SpouseType } from './calc'

const STORAGE_KEY = 'furusato-limit-simulator:input:v1'

export function isValidInputShape(p: unknown): p is SimulatorInput {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return (
    typeof o.salaryYen === 'number' &&
    (o.socialInsuranceYen === null || typeof o.socialInsuranceYen === 'number') &&
    (o.spouse === 'none' || o.spouse === 'deduction') &&
    typeof o.dependents === 'number' &&
    typeof o.specialDependents === 'number'
  )
}

export function saveInput(input: SimulatorInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージ使用不可でも致命的にしない
  }
}

export function loadInput(): SimulatorInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidInputShape(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルの形式が不正です（JSONとして読み込めません）。')
  }
  if (!isValidInputShape(parsed)) {
    throw new Error('インポートしたファイルの形式が不正です（項目が不足しているか型が違います）。')
  }
  const spouse: SpouseType = parsed.spouse
  return { ...parsed, spouse }
}
