import type { SimulatorInput } from './calc'

const STORAGE_KEY = 'furusato-limit-simulator:input:v1'

function isValidShape(p: unknown): p is SimulatorInput {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Record<string, unknown>
  return (
    typeof o.salaryYen === 'number' &&
    (o.socialInsuranceYen === null || typeof o.socialInsuranceYen === 'number') &&
    typeof o.extraDeductionYen === 'number' &&
    typeof o.donatedYen === 'number'
  )
}

export function saveInput(input: SimulatorInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージが使えない環境でも致命的にしない
  }
}

export function loadInput(): SimulatorInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidShape(parsed) ? parsed : null
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
    throw new Error('インポートしたファイルがJSONとして読み込めません。')
  }
  if (!isValidShape(parsed)) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  const { salaryYen, socialInsuranceYen, extraDeductionYen, donatedYen } = parsed
  return { salaryYen, socialInsuranceYen, extraDeductionYen, donatedYen }
}
