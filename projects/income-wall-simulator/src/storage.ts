import type { SimulatorInput } from './calc'

const STORAGE_KEY = 'income-wall-simulator:input:v1'

export function saveInput(input: SimulatorInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // ブラウザのストレージが使用不可（プライベートモード等）でも致命的にしない
  }
}

export function loadInput(): SimulatorInput | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      typeof parsed.hourlyWageYen === 'number' &&
      typeof parsed.hoursPerWeek === 'number' &&
      typeof parsed.weeksPerMonth === 'number' &&
      typeof parsed.otherAnnualIncomeYen === 'number'
    ) {
      return parsed as SimulatorInput
    }
    return null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  const json = JSON.stringify(input, null, 2)
  return new Blob([json], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  const parsed = JSON.parse(text)
  const required = ['hourlyWageYen', 'hoursPerWeek', 'weeksPerMonth', 'otherAnnualIncomeYen']
  for (const key of required) {
    if (typeof parsed[key] !== 'number') {
      throw new Error(`インポートしたファイルの形式が不正です（${key} が数値ではありません）。`)
    }
  }
  return parsed as SimulatorInput
}
