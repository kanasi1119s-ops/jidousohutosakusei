import { BUSINESS_TYPES, TAX_YEARS } from './rules'
import type { SimulatorInput } from './calc'

const STORAGE_KEY = 'consumption-tax-special-simulator:input:v1'

const NUMBER_KEYS = [
  'salesStandardYen',
  'salesReducedYen',
  'purchasesStandardYen',
  'purchasesReducedYen',
  'baseSalesYen',
] as const

/** 保存データ／インポートデータを検証して SimulatorInput に変換する。不正なら例外。 */
export function normalizeInput(parsed: unknown): SimulatorInput {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('インポートしたファイルの形式が不正です。')
  }
  const p = parsed as Record<string, unknown>
  for (const key of NUMBER_KEYS) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key] as number)) {
      throw new Error(`インポートしたファイルの形式が不正です（${key} が数値ではありません）。`)
    }
  }
  if (!(TAX_YEARS as readonly unknown[]).includes(p.year)) {
    throw new Error('インポートしたファイルの形式が不正です（year）。')
  }
  if (!BUSINESS_TYPES.some((b) => b.id === p.businessType)) {
    throw new Error('インポートしたファイルの形式が不正です（businessType）。')
  }
  if (typeof p.registeredToBecomeTaxable !== 'boolean') {
    throw new Error('インポートしたファイルの形式が不正です（registeredToBecomeTaxable）。')
  }
  return {
    year: p.year as SimulatorInput['year'],
    salesStandardYen: p.salesStandardYen as number,
    salesReducedYen: p.salesReducedYen as number,
    purchasesStandardYen: p.purchasesStandardYen as number,
    purchasesReducedYen: p.purchasesReducedYen as number,
    businessType: p.businessType as SimulatorInput['businessType'],
    registeredToBecomeTaxable: p.registeredToBecomeTaxable,
    baseSalesYen: p.baseSalesYen as number,
  }
}

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
    return raw ? normalizeInput(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function inputToJsonBlob(input: SimulatorInput): Blob {
  return new Blob([JSON.stringify(input, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseInputFromJsonText(text: string): SimulatorInput {
  // 先頭のBOMがあれば取り除く
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('インポートしたファイルがJSONとして読み取れません。')
  }
  return normalizeInput(parsed)
}
