import { DEFAULT_INPUT, sanitizeInput, type SimulatorInput } from './calc'

const STORAGE_KEY = 'furusato-limit-simulator:input:v1'

export function saveInput(input: SimulatorInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ストレージ使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadInput(): SimulatorInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return validateInput(JSON.parse(raw))
  } catch {
    return null
  }
}

export function validateInput(value: unknown): SimulatorInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  const v = value as Record<string, unknown>
  const numberKeys = [
    'salaryYen',
    'dependentsGeneral',
    'dependentsSpecific',
    'dependentsElderly',
    'otherDeductionsYen',
    'housingLoanResidentTaxYen',
    'plannedDonationYen',
  ] as const
  for (const key of numberKeys) {
    if (typeof v[key] !== 'number' || !Number.isFinite(v[key] as number)) {
      throw new Error(`インポートしたファイルの形式が不正です（${key} が数値ではありません）。`)
    }
  }
  if (v.socialInsuranceYen !== null && (typeof v.socialInsuranceYen !== 'number' || !Number.isFinite(v.socialInsuranceYen))) {
    throw new Error('インポートしたファイルの形式が不正です（socialInsuranceYen が不正です）。')
  }
  if (v.spouse !== 'none' && v.spouse !== 'spouse' && v.spouse !== 'special') {
    throw new Error('インポートしたファイルの形式が不正です（spouse が不正です）。')
  }
  return sanitizeInput({ ...DEFAULT_INPUT, ...(v as unknown as SimulatorInput) })
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  // 先頭のBOMがあれば除去してから解析する
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み込めません。')
  }
  return validateInput(parsed)
}
