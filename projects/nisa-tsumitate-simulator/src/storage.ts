import type { SimulatorInput } from './calc'

const STORAGE_KEY = 'nisa-tsumitate-simulator:input:v1'
const KEYS: (keyof SimulatorInput)[] = [
  'initialYen',
  'monthlyYen',
  'annualReturnPct',
  'years',
  'inflationPct',
  'goalYen',
]

function coerce(parsed: unknown): SimulatorInput {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  const obj = parsed as Record<string, unknown>
  const out: Partial<SimulatorInput> = {}
  for (const key of KEYS) {
    const v = obj[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`インポートしたファイルの形式が不正です（${key} が数値ではありません）。`)
    }
    out[key] = v
  }
  return out as SimulatorInput
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
    return raw ? coerce(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み取れません。')
  }
  return coerce(parsed)
}
